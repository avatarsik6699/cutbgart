import { ProcessingGatewayError } from "@/v2/application";
import type { LocalInferencePath, ProcessingError } from "@/v2/domain";

import type {
  EnhancementWorker,
  EnhancementWorkerFactory,
} from "./enhancement-worker-factory";
import {
  ENHANCEMENT_WORKER_PROTOCOL_VERSION,
  isEnhancementWorkerEvent,
  sameEnhancementCorrelation,
  type EnhancementRunCorrelation,
  type EnhancementWorkerEvent,
  type EnhancementWorkerStage,
  type EnhancementWorkerSuccess,
} from "./enhancement-worker-protocol";

export type EnhancementWorkerProgress = {
  stage: EnhancementWorkerStage;
  fraction: number | null;
};

export type EnhancementWorkerResult =
  | {
      operationId: "fine-detail";
      matte: Uint8ClampedArray;
      changed: boolean;
      actualMode: Extract<
        EnhancementWorkerSuccess,
        { operationId: "fine-detail" }
      >["actualMode"];
      actualPath: LocalInferencePath | null;
      fallback: Extract<
        EnhancementWorkerSuccess,
        { operationId: "fine-detail" }
      >["fallback"];
    }
  | {
      operationId: "colour-halo";
      matte: Uint8ClampedArray;
      foreground: Blob | null;
      changed: boolean;
      actualPath: Extract<
        EnhancementWorkerSuccess,
        { operationId: "colour-halo" }
      >["actualPath"];
      fallback: Extract<
        EnhancementWorkerSuccess,
        { operationId: "colour-halo" }
      >["fallback"];
    };

export type EnhancementWorkerRunInput = EnhancementRunCorrelation & {
  source: Blob;
  matte: Uint8ClampedArray;
  width: number;
  height: number;
  requestedMode?: "balanced" | "maximum";
  requestedPath?: LocalInferencePath;
};

export type EnhancementOperationRunner = {
  run(
    input: EnhancementWorkerRunInput,
    signal: AbortSignal,
    publish: (progress: EnhancementWorkerProgress) => void,
  ): Promise<EnhancementWorkerResult>;
  reset(): void;
  dispose(): void;
};

type ActiveRun = {
  input: EnhancementWorkerRunInput;
  signal: AbortSignal;
  abortFx: () => void;
  publish(progress: EnhancementWorkerProgress): void;
  resolve(value: EnhancementWorkerResult): void;
  reject(error: ProcessingGatewayError): void;
  progress: EnhancementWorkerProgress | null;
};

const STAGE_ORDER: Record<EnhancementWorkerStage, number> = {
  "enhancement-model-loading": 0,
  "enhancement-fine-detail": 1,
  "enhancement-colour-halo": 1,
};

function gatewayError(detail: ProcessingError): ProcessingGatewayError {
  return new ProcessingGatewayError(detail);
}

function correlation(input: EnhancementWorkerRunInput): EnhancementRunCorrelation {
  return {
    documentId: input.documentId,
    draftId: input.draftId,
    runId: input.runId,
    expectedRevision: input.expectedRevision,
    operationId: input.operationId,
  };
}

function mediaType(blob: Blob): "image/jpeg" | "image/png" | "image/webp" {
  if (
    blob.type === "image/jpeg" ||
    blob.type === "image/png" ||
    blob.type === "image/webp"
  )
    return blob.type;
  throw gatewayError({
    code: "invalid-request",
    message: "Enhancement source must be JPEG, PNG, or WebP",
    retryable: false,
  });
}

export class EnhancementWorkerClient implements EnhancementOperationRunner {
  readonly #factory: EnhancementWorkerFactory;
  #active: ActiveRun | null = null;
  #disposed = false;
  #worker: EnhancementWorker | null = null;

  constructor(factory: EnhancementWorkerFactory) {
    this.#factory = factory;
  }

  async run(
    input: EnhancementWorkerRunInput,
    signal: AbortSignal,
    publish: (progress: EnhancementWorkerProgress) => void,
  ): Promise<EnhancementWorkerResult> {
    if (this.#disposed) throw this.#error("Enhancement worker client is disposed", false);
    if (signal.aborted) throw this.#aborted();
    if (this.#active !== null)
      throw this.#error("An enhancement operation is already active", true);
    if (
      input.width <= 0 ||
      input.height <= 0 ||
      input.matte.length !== input.width * input.height
    ) {
      throw this.#error("Enhancement matte dimensions are invalid", false);
    }
    const sourceBytes = await input.source.arrayBuffer();
    const matte = input.matte.slice().buffer;
    const sourceMediaType = mediaType(input.source);
    if (signal.aborted) throw this.#aborted();
    return new Promise((resolve, reject) => {
      const active: ActiveRun = {
        input,
        signal,
        publish,
        resolve,
        reject,
        progress: null,
        abortFx: () => undefined,
      };
      active.abortFx = () => {
        if (this.#active !== active) return;
        try {
          this.#worker?.postMessage({
            protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
            type: "CANCEL",
            correlation: correlation(input),
          });
        } finally {
          this.#take(active)?.reject(this.#aborted());
          this.#resetWorker();
        }
      };
      this.#active = active;
      signal.addEventListener("abort", active.abortFx, { once: true });
      const base = {
        protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
        type: "RUN" as const,
        correlation: correlation(input),
        source: { bytes: sourceBytes, mediaType: sourceMediaType },
        matte,
        width: input.width,
        height: input.height,
      };
      try {
        this.#getWorker().postMessage(
          input.operationId === "fine-detail"
            ? {
                ...base,
                correlation: { ...correlation(input), operationId: "fine-detail" },
                requestedMode: input.requestedMode ?? "balanced",
                requestedPath: input.requestedPath ?? "wasm",
              }
            : {
                ...base,
                correlation: { ...correlation(input), operationId: "colour-halo" },
              },
          [sourceBytes, matte],
        );
      } catch (error) {
        this.#take(active)?.reject(
          this.#error(
            error instanceof Error ? error.message : "Could not start enhancement worker",
            true,
          ),
        );
      }
    });
  }

  reset(): void {
    if (this.#disposed) return;
    this.#take(this.#active)?.reject(this.#aborted());
    this.#resetWorker();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#take(this.#active)?.reject(this.#aborted());
    this.#resetWorker();
  }

  readonly #messageFx = (message: MessageEvent<unknown>): void => {
    if (!isEnhancementWorkerEvent(message.data)) {
      this.#fail("Invalid enhancement worker event");
      return;
    }
    const event = message.data;
    if (event.type === "DISPOSED") return;
    const active = this.#active;
    if (
      active === null ||
      !sameEnhancementCorrelation(correlation(active.input), event.correlation)
    )
      return;
    if (event.type === "ACCEPTED") return;
    if (event.type === "PROGRESS") {
      const progress = { stage: event.stage, fraction: event.fraction };
      if (!this.#isForwardProgress(active.progress, progress)) return;
      active.progress = progress;
      active.publish(progress);
      return;
    }
    if (event.type === "FAILED") {
      this.#take(active)?.reject(gatewayError(event.error));
      return;
    }
    if (event.type === "CANCELLED") {
      this.#take(active)?.reject(this.#aborted());
      return;
    }
    const result = this.#result(event);
    if (result.matte.length !== active.input.width * active.input.height) {
      this.#fail("Enhancement worker returned invalid matte dimensions");
      return;
    }
    this.#take(active)?.resolve(result);
  };

  readonly #crashFx = (event: Event): void => {
    const message =
      "message" in event && typeof event.message === "string"
        ? event.message
        : "Enhancement worker crashed";
    this.#take(this.#active)?.reject(
      gatewayError({ code: "worker-crashed", message, retryable: true }),
    );
    this.#resetWorker();
  };

  #result(
    event: Extract<EnhancementWorkerEvent, { type: "SUCCEEDED" }>,
  ): EnhancementWorkerResult {
    const matte = new Uint8ClampedArray(event.output.matte);
    return event.output.operationId === "fine-detail"
      ? { ...event.output, matte }
      : {
          operationId: event.output.operationId,
          matte,
          changed: event.output.changed,
          foreground:
            event.output.foregroundPng === null
              ? null
              : new Blob([event.output.foregroundPng], { type: "image/png" }),
          actualPath: event.output.actualPath,
          fallback: event.output.fallback,
        };
  }

  #getWorker(): EnhancementWorker {
    if (this.#worker !== null) return this.#worker;
    const worker = this.#factory.create();
    worker.addEventListener("message", this.#messageFx);
    worker.addEventListener("error", this.#crashFx);
    worker.addEventListener("messageerror", this.#crashFx);
    this.#worker = worker;
    return worker;
  }

  #resetWorker(): void {
    const worker = this.#worker;
    this.#worker = null;
    if (worker === null) return;
    worker.removeEventListener("message", this.#messageFx);
    worker.removeEventListener("error", this.#crashFx);
    worker.removeEventListener("messageerror", this.#crashFx);
    try {
      worker.postMessage({
        protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
        type: "DISPOSE_RUNTIME",
      });
    } finally {
      worker.terminate();
    }
  }

  #take(expected: ActiveRun | null): ActiveRun | null {
    if (expected === null || this.#active !== expected) return null;
    this.#active = null;
    expected.signal.removeEventListener("abort", expected.abortFx);
    return expected;
  }

  #fail(message: string): void {
    this.#take(this.#active)?.reject(
      gatewayError({ code: "worker-protocol-error", message, retryable: true }),
    );
    this.#resetWorker();
  }

  #aborted(): ProcessingGatewayError {
    return gatewayError({
      code: "aborted",
      message: "Enhancement operation was cancelled",
      retryable: true,
    });
  }

  #error(message: string, retryable: boolean): ProcessingGatewayError {
    return gatewayError({ code: "processing-failed", message, retryable });
  }

  #isForwardProgress(
    previous: EnhancementWorkerProgress | null,
    next: EnhancementWorkerProgress,
  ): boolean {
    if (previous === null) return true;
    const previousOrder = STAGE_ORDER[previous.stage];
    const nextOrder = STAGE_ORDER[next.stage];
    return !(
      nextOrder < previousOrder ||
      (nextOrder === previousOrder &&
        previous.fraction !== null &&
        next.fraction !== null &&
        next.fraction < previous.fraction)
    );
  }
}
