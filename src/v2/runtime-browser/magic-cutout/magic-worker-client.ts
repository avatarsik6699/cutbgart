import { ProcessingGatewayError } from "@/v2/application";
import type {
  ArtifactId,
  MagicPredictionCorrelation,
  ProcessingError,
} from "@/v2/domain";
import { GUIDED_MODEL } from "@/shared/lib/inference/production-model-config";

import type { ArtifactRepository } from "../artifacts";
import {
  encodedMediaType,
  type HeavyJobCoordinator,
  transferableBytes,
} from "../processing";
import type { MagicStroke } from "./magic-cutout.types";
import type { MagicWorker, MagicWorkerFactory } from "./magic-worker-factory";
import {
  MAGIC_WORKER_PROTOCOL_VERSION,
  sameMagicCorrelation,
  type MagicPredictionStage,
  type MagicWorkerEvent,
  type TransferableMagicCandidate,
} from "./magic-worker-protocol";

export type MagicWorkerPredictionInput = MagicPredictionCorrelation & {
  source: ArtifactId;
  strokes: readonly MagicStroke[];
};

export type MagicPredictionProgress = {
  stage: MagicPredictionStage;
  fraction: number | null;
};

type ActivePrediction = {
  input: MagicWorkerPredictionInput;
  signal: AbortSignal;
  abortFx: () => void;
  publish(progress: MagicPredictionProgress): void;
  resolve(candidates: readonly TransferableMagicCandidate[]): void;
  reject(error: ProcessingGatewayError): void;
  progress: MagicPredictionProgress | null;
};

const STAGE_ORDER: Record<MagicPredictionStage, number> = {
  "magic-model-loading": 0,
  "magic-encode": 1,
  "magic-predict": 2,
};

function gatewayError(detail: ProcessingError): ProcessingGatewayError {
  return new ProcessingGatewayError(detail);
}

export class MagicWorkerClient {
  readonly #factory: MagicWorkerFactory;
  readonly #coordinator: HeavyJobCoordinator;
  readonly #repository: ArtifactRepository;
  #active: ActivePrediction | null = null;
  #disposed = false;
  #worker: MagicWorker | null = null;

  constructor(options: {
    coordinator: HeavyJobCoordinator;
    factory: MagicWorkerFactory;
    repository: ArtifactRepository;
  }) {
    this.#coordinator = options.coordinator;
    this.#factory = options.factory;
    this.#repository = options.repository;
  }

  async predict(
    input: MagicWorkerPredictionInput,
    signal: AbortSignal,
    publish: (progress: MagicPredictionProgress) => void,
  ): Promise<readonly TransferableMagicCandidate[]> {
    if (this.#disposed) throw this.#error("Magic worker client is disposed", false);
    if (signal.aborted) throw this.#aborted();
    if (input.strokes.length === 0) throw this.#error("Magic strokes are required", true);

    return this.#coordinator.schedule({
      kind: "magic-cutout",
      signal,
      execute: (admittedSignal) => this.#execute(input, admittedSignal, publish),
    });
  }

  async #execute(
    input: MagicWorkerPredictionInput,
    signal: AbortSignal,
    publish: (progress: MagicPredictionProgress) => void,
  ): Promise<readonly TransferableMagicCandidate[]> {
    if (this.#disposed) throw this.#error("Magic worker client is disposed", false);
    if (this.#active !== null)
      throw this.#error("Magic prediction is already active", true);
    if (signal.aborted) throw this.#aborted();

    const sourceValue = this.#repository.read(input.source);
    const metadata = this.#repository.metadata(input.source);
    if (sourceValue === null || metadata === null) {
      throw gatewayError({
        code: "artifact-unavailable",
        message: "Magic source artifact is unavailable",
        retryable: false,
      });
    }
    const bytes = await transferableBytes(sourceValue);
    if (signal.aborted) throw this.#aborted();

    return new Promise((resolve, reject) => {
      const active: ActivePrediction = {
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
        this.#getWorker().postMessage({
          protocol: MAGIC_WORKER_PROTOCOL_VERSION,
          type: "CANCEL",
          correlation: input,
        });
      };
      this.#active = active;
      signal.addEventListener("abort", active.abortFx, { once: true });
      try {
        this.#getWorker().postMessage(
          {
            protocol: MAGIC_WORKER_PROTOCOL_VERSION,
            type: "PREDICT",
            correlation: input,
            model: GUIDED_MODEL,
            source: {
              bytes,
              height: metadata.height,
              mediaType: encodedMediaType(metadata.mediaType),
              width: metadata.width,
            },
            strokes: input.strokes,
          },
          [bytes],
        );
      } catch (error) {
        this.#takeActive(active)?.reject(
          this.#error(
            error instanceof Error ? error.message : "Could not start Magic worker",
            true,
          ),
        );
      }
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#takeActive(this.#active)?.reject(this.#aborted());
    this.#worker?.postMessage({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "DISPOSE_RUNTIME",
    });
    this.#worker?.terminate();
    this.#worker = null;
  }

  reset(): void {
    if (this.#disposed) return;
    this.#takeActive(this.#active)?.reject(this.#aborted());
    this.#worker?.postMessage({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "DISPOSE_RUNTIME",
    });
    this.#worker?.terminate();
    this.#worker = null;
  }

  readonly #handleMessage = (message: MessageEvent<MagicWorkerEvent>): void => {
    const event = message.data;
    if (event.protocol !== MAGIC_WORKER_PROTOCOL_VERSION) {
      this.#fail("Unsupported Magic worker protocol version");
      return;
    }
    if (event.type === "DISPOSED") return;
    const active = this.#active;
    if (active === null || !sameMagicCorrelation(active.input, event.correlation)) return;
    switch (event.type) {
      case "ACCEPTED":
        return;
      case "PROGRESS":
        if (!this.#isForwardProgress(active.progress, event.stage, event.fraction))
          return;
        active.progress = { stage: event.stage, fraction: event.fraction };
        active.publish(active.progress);
        return;
      case "SUCCEEDED":
        this.#takeActive(active)?.resolve(event.candidates);
        return;
      case "FAILED":
        this.#takeActive(active)?.reject(gatewayError(event.error));
        return;
      case "CANCELLED":
        this.#takeActive(active)?.reject(this.#aborted());
    }
  };

  readonly #handleCrash = (event: Event): void => {
    const message =
      "message" in event && typeof event.message === "string"
        ? event.message
        : "Magic worker crashed";
    this.#takeActive(this.#active)?.reject(
      gatewayError({ code: "worker-crashed", message, retryable: true }),
    );
    this.#worker?.terminate();
    this.#worker = null;
  };

  #getWorker(): MagicWorker {
    if (this.#worker !== null) return this.#worker;
    const worker = this.#factory.create();
    worker.addEventListener("message", this.#handleMessage);
    worker.addEventListener("error", this.#handleCrash);
    worker.addEventListener("messageerror", this.#handleCrash);
    this.#worker = worker;
    return worker;
  }

  #fail(message: string): void {
    this.#takeActive(this.#active)?.reject(
      gatewayError({ code: "worker-protocol-error", message, retryable: true }),
    );
  }

  #takeActive(expected: ActivePrediction | null): ActivePrediction | null {
    if (expected === null || this.#active !== expected) return null;
    this.#active = null;
    expected.signal.removeEventListener("abort", expected.abortFx);
    return expected;
  }

  #aborted(): ProcessingGatewayError {
    return gatewayError({
      code: "aborted",
      message: "Magic prediction was cancelled",
      retryable: true,
    });
  }

  #error(message: string, retryable: boolean): ProcessingGatewayError {
    return gatewayError({ code: "processing-failed", message, retryable });
  }

  #isForwardProgress(
    previous: MagicPredictionProgress | null,
    stage: MagicPredictionStage,
    fraction: number | null,
  ): boolean {
    if (
      fraction !== null &&
      (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    ) {
      return false;
    }
    if (previous === null) return true;
    const previousOrder = STAGE_ORDER[previous.stage];
    const nextOrder = STAGE_ORDER[stage];
    if (nextOrder < previousOrder) return false;
    if (
      nextOrder === previousOrder &&
      previous.fraction !== null &&
      fraction !== null &&
      fraction < previous.fraction
    ) {
      return false;
    }
    return true;
  }
}
