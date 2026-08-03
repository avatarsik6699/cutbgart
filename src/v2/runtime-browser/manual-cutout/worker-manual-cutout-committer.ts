import type { ManualCutoutCommitRequest, ManualCutoutCommitter } from "@/v2/application";
import type { ArtifactMediaType, DocumentSnapshot } from "@/v2/domain";

import type { ArtifactRepository, ArtifactValue } from "../artifacts";
import {
  MANUAL_COMMIT_PROTOCOL_VERSION,
  sameManualCorrelation,
  type ManualCommitWorkerEvent,
} from "./manual-commit-protocol";

type ManualWorker = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ManualCommitWorkerEvent>) => void,
  ): void;
  postMessage(message: unknown, transfer: Transferable[]): void;
  terminate(): void;
};

export type ManualCutoutWorkerFactory = { create(): ManualWorker };

async function bytes(value: ArtifactValue): Promise<ArrayBuffer> {
  if (value instanceof Blob) return value.arrayBuffer();
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (value instanceof Uint8ClampedArray) return value.slice().buffer;
  throw new Error("Manual commit source is not encoded bytes");
}

function mediaType(value: ArtifactMediaType): "image/jpeg" | "image/png" | "image/webp" {
  if (value === "image/jpeg" || value === "image/png" || value === "image/webp")
    return value;
  throw new Error("Manual commit source media type is invalid");
}

function cancelledError(): Error {
  const error = new Error("Manual commit cancelled");
  error.name = "AbortError";
  return error;
}

export function createNativeManualCutoutWorkerFactory(): ManualCutoutWorkerFactory {
  return {
    create: () =>
      new Worker(new URL("./worker/manual-cutout.worker.ts", import.meta.url), {
        type: "module",
      }),
  };
}

export class WorkerManualCutoutCommitter implements ManualCutoutCommitter {
  readonly #factory: ManualCutoutWorkerFactory;
  readonly #repository: ArtifactRepository;

  constructor(
    repository: ArtifactRepository,
    factory: ManualCutoutWorkerFactory = createNativeManualCutoutWorkerFactory(),
  ) {
    this.#repository = repository;
    this.#factory = factory;
  }

  async commit(
    request: ManualCutoutCommitRequest,
    signal: AbortSignal,
  ): Promise<DocumentSnapshot> {
    const sourceValue = this.#repository.read(request.source);
    const sourceMetadata = this.#repository.metadata(request.source);
    const matteValue = this.#repository.read(request.draftMatte);
    const matteMetadata = this.#repository.metadata(request.draftMatte);
    if (
      sourceValue === null ||
      sourceMetadata === null ||
      !(matteValue instanceof Uint8ClampedArray) ||
      matteMetadata === null
    ) {
      throw new Error("Manual cutout artifacts are unavailable");
    }
    const sourceBytes = await bytes(sourceValue);
    const matte = matteValue.slice().buffer;
    if (signal.aborted) throw cancelledError();
    const worker = this.#factory.create();
    return new Promise<DocumentSnapshot>((resolve, reject) => {
      const abortFx = (): void => {
        worker.terminate();
        reject(cancelledError());
      };
      signal.addEventListener("abort", abortFx, { once: true });
      worker.addEventListener("message", (event) => {
        if (!sameManualCorrelation(event.data.correlation, request)) return;
        signal.removeEventListener("abort", abortFx);
        worker.terminate();
        if (event.data.type === "FAILED") {
          reject(new Error(event.data.message));
          return;
        }
        try {
          const owner = {
            kind: "manual-draft",
            documentId: request.documentId,
            draftId: request.draftId,
          } as const;
          const composite = this.#repository.register(
            new Blob([event.data.compositePng], { type: "image/png" }),
            {
              kind: "composite",
              mediaType: "image/png",
              width: matteMetadata.width,
              height: matteMetadata.height,
              estimatedBytes: event.data.compositePng.byteLength,
            },
            owner,
          );
          resolve({ matte: request.draftMatte, foreground: null, composite });
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("Manual output registration failed"),
          );
        }
      });
      worker.postMessage(
        {
          protocol: MANUAL_COMMIT_PROTOCOL_VERSION,
          type: "MANUAL_CUTOUT_COMMIT",
          correlation: request,
          source: { bytes: sourceBytes, mediaType: mediaType(sourceMetadata.mediaType) },
          matte,
          width: matteMetadata.width,
          height: matteMetadata.height,
        },
        [sourceBytes, matte],
      );
    });
  }
}
