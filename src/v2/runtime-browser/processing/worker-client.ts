import { ProcessingGatewayError } from "@/v2/application";
import {
  type DocumentSnapshot,
  type ProcessingError,
  type ProcessingProgress,
  type ProcessingRequest,
} from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";
import type { LocalProcessingExecutor } from "./local-processing-gateway";
import type { LocalModelConfig } from "./model-config";
import type { ProcessingWorker, ProcessingWorkerFactory } from "./worker-factory";
import {
  PROCESSING_WORKER_PROTOCOL_VERSION,
  sameCorrelation,
  type ProcessingWorkerEvent,
} from "./worker-protocol";
import { acceptWorkerProgress } from "./worker-progress-policy";
import { registerWorkerOutput } from "./worker-output-registration";
import { encodedMediaType, transferableBytes } from "./worker-source-transfer";

type ActiveExecution = {
  abortListener: () => void;
  lastFraction: number | null;
  lastStageIndex: number;
  publish(progress: ProcessingProgress): void;
  reject(error: ProcessingGatewayError): void;
  request: ProcessingRequest;
  resolve(snapshot: DocumentSnapshot): void;
  signal: AbortSignal;
};

export type WorkerProcessingExecutorOptions = {
  factory: ProcessingWorkerFactory;
  model: LocalModelConfig;
  repository: ArtifactRepository;
};

function gatewayError(detail: ProcessingError): ProcessingGatewayError {
  return new ProcessingGatewayError(detail);
}

export class WorkerProcessingExecutor implements LocalProcessingExecutor {
  readonly #factory: ProcessingWorkerFactory;
  readonly #model: LocalModelConfig;
  readonly #repository: ArtifactRepository;
  #active: ActiveExecution | null = null;
  #claimed = false;
  #disposed = false;
  #disposeResolver: (() => void) | null = null;
  #worker: ProcessingWorker | null = null;

  constructor(options: WorkerProcessingExecutorOptions) {
    this.#factory = options.factory;
    this.#model = options.model;
    this.#repository = options.repository;
  }

  async execute(
    request: ProcessingRequest,
    signal: AbortSignal,
    publish: (progress: ProcessingProgress) => void,
  ): Promise<DocumentSnapshot> {
    if (this.#disposed) {
      throw gatewayError({
        code: "processing-failed",
        message: "Worker processing executor is disposed",
        retryable: false,
      });
    }
    if (this.#active !== null || this.#claimed) {
      throw gatewayError({
        code: "invalid-request",
        message: "Only one heavy local processing run may be active",
        retryable: true,
      });
    }
    if (signal.aborted) {
      throw gatewayError({
        code: "aborted",
        message: "Processing was cancelled",
        retryable: true,
      });
    }

    this.#claimed = true;
    try {
      const sourceValue = this.#repository.read(request.source);
      const sourceMetadata = this.#repository.metadata(request.source);
      if (sourceValue === null || sourceMetadata === null) {
        throw gatewayError({
          code: "artifact-unavailable",
          message: "Source artifact is unavailable",
          retryable: false,
        });
      }
      const bytes = await transferableBytes(sourceValue);
      if (this.#disposed || signal.aborted) {
        throw gatewayError({
          code: "aborted",
          message: "Processing was cancelled",
          retryable: true,
        });
      }

      return await new Promise<DocumentSnapshot>((resolve, reject) => {
        const active: ActiveExecution = {
          abortListener: () => undefined,
          lastFraction: null,
          lastStageIndex: -1,
          publish,
          reject,
          request,
          resolve,
          signal,
        };
        this.#active = active;

        const abortFx = (): void => {
          const worker = this.#worker;
          if (worker === null || this.#active !== active) {
            return;
          }
          worker.postMessage({
            protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
            type: "CANCEL",
            correlation: request,
          });
        };
        active.abortListener = abortFx;
        signal.addEventListener("abort", abortFx, { once: true });

        const worker = this.#getWorker();
        try {
          worker.postMessage(
            {
              protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
              type: "RUN",
              correlation: request,
              model: this.#model,
              source: {
                bytes,
                height: sourceMetadata.height,
                mediaType: encodedMediaType(sourceMetadata.mediaType),
                width: sourceMetadata.width,
              },
            },
            [bytes],
          );
        } catch (error) {
          this.#takeActive(active);
          reject(
            gatewayError({
              code: "worker-crashed",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not start processing worker",
              retryable: true,
            }),
          );
        }
      });
    } finally {
      this.#claimed = false;
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    const worker = this.#worker;
    if (worker === null) {
      return;
    }

    if (this.#active !== null) {
      const active = this.#takeActive(this.#active);
      active?.reject(
        gatewayError({
          code: "aborted",
          message: "Processing was cancelled",
          retryable: true,
        }),
      );
    }

    const disposed = new Promise<void>((resolve) => {
      this.#disposeResolver = resolve;
    });
    worker.postMessage({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "DISPOSE_RUNTIME",
    });

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const bounded = new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, 2_000);
    });
    await Promise.race([disposed, bounded]);
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    this.#resetWorker();
  }

  #completeActive(event: Extract<ProcessingWorkerEvent, { type: "SUCCEEDED" }>): void {
    const active = this.#takeActive(this.#active);
    if (active === null) {
      return;
    }

    try {
      active.resolve(registerWorkerOutput(this.#repository, active.request, event));
    } catch (error) {
      active.reject(
        error instanceof ProcessingGatewayError
          ? error
          : gatewayError({
              code: "processing-failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not register worker output",
              retryable: true,
            }),
      );
    }
  }

  #getWorker(): ProcessingWorker {
    if (this.#worker !== null) {
      return this.#worker;
    }
    const worker = this.#factory.create();
    worker.addEventListener("message", this.#handleMessage);
    worker.addEventListener("error", this.#handleWorkerCrash);
    worker.addEventListener("messageerror", this.#handleMessageError);
    this.#worker = worker;
    return worker;
  }

  readonly #handleMessage = (messageEvent: MessageEvent<ProcessingWorkerEvent>) => {
    const event = messageEvent.data;
    if (event.protocol !== PROCESSING_WORKER_PROTOCOL_VERSION) {
      this.#failProtocol("Unsupported worker protocol version");
      return;
    }
    if (event.type === "DISPOSED") {
      this.#disposeResolver?.();
      this.#disposeResolver = null;
      return;
    }

    const active = this.#active;
    if (active === null || !sameCorrelation(event.correlation, active.request)) {
      return;
    }

    switch (event.type) {
      case "ACCEPTED":
        active.publish({ ...active.request, stage: "queued", fraction: null });
        break;
      case "PROGRESS": {
        const progress = acceptWorkerProgress(active, event);
        if (progress === null) {
          this.#failProtocol("Worker progress is not monotonic");
          return;
        }
        active.publish(progress);
        break;
      }
      case "SUCCEEDED":
        this.#completeActive(event);
        break;
      case "FAILED":
        this.#takeActive(active)?.reject(gatewayError(event.error));
        break;
      case "CANCELLED":
        this.#takeActive(active)?.reject(
          gatewayError({
            code: "aborted",
            message: "Processing was cancelled",
            retryable: true,
          }),
        );
        break;
    }
  };

  readonly #handleMessageError = () => {
    this.#failProtocol("Worker message could not be deserialized");
    this.#resetWorker();
  };

  readonly #handleWorkerCrash = (event: Event) => {
    const message =
      "message" in event && typeof event.message === "string"
        ? event.message
        : "Worker crashed";
    this.#takeActive(this.#active)?.reject(
      gatewayError({ code: "worker-crashed", message, retryable: true }),
    );
    this.#resetWorker();
  };

  #failProtocol(message: string): void {
    this.#takeActive(this.#active)?.reject(
      gatewayError({ code: "worker-protocol-error", message, retryable: true }),
    );
  }

  #takeActive(expected: ActiveExecution | null): ActiveExecution | null {
    if (expected === null || this.#active !== expected) {
      return null;
    }
    this.#active = null;
    expected.signal.removeEventListener("abort", expected.abortListener);
    return expected;
  }

  #resetWorker(): void {
    this.#worker?.terminate();
    this.#worker = null;
    this.#disposeResolver?.();
    this.#disposeResolver = null;
  }
}
