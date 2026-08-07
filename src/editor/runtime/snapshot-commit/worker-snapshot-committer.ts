import type { ArtifactId, ArtifactLeaseOwner, DocumentSnapshot } from "@/editor/domain";

import type { ArtifactRepository } from "../artifacts";
import { encodedMediaType, transferableBytes } from "../processing";
import {
  isSnapshotCommitWorkerEvent,
  sameSnapshotCommitCorrelation,
  SNAPSHOT_COMMIT_PROTOCOL_VERSION,
  type SnapshotCommitCorrelation,
  type SnapshotCommitWorkerBackground,
  type SnapshotCommitWorkerCommand,
  type SnapshotCommitWorkerImage,
} from "./snapshot-commit-protocol";

export type SnapshotCommitRequest = SnapshotCommitCorrelation & {
  draftMatte: ArtifactId;
  source: ArtifactId;
  foreground?: ArtifactId | null;
  background: DocumentSnapshot["background"];
};

export type SnapshotCommitter = {
  commit(
    request: SnapshotCommitRequest,
    owner: Extract<
      ArtifactLeaseOwner,
      { kind: "manual-draft" | "magic-draft" | "background-draft" | "run" }
    >,
    signal: AbortSignal,
  ): Promise<DocumentSnapshot>;
};

export type SnapshotCommitWorker = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  addEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  postMessage(message: SnapshotCommitWorkerCommand, transfer: Transferable[]): void;
  terminate(): void;
};

export type SnapshotCommitWorkerFactory = { create(): SnapshotCommitWorker };

function cancelledError(): Error {
  const error = new Error("Snapshot commit cancelled");
  error.name = "AbortError";
  return error;
}

export function createNativeSnapshotCommitWorkerFactory(): SnapshotCommitWorkerFactory {
  return {
    create: () =>
      new Worker(new URL("./worker/snapshot-commit.worker.ts", import.meta.url), {
        type: "module",
      }),
  };
}

export class WorkerSnapshotCommitter implements SnapshotCommitter {
  readonly #factory: SnapshotCommitWorkerFactory;
  readonly #repository: ArtifactRepository;

  constructor(
    repository: ArtifactRepository,
    factory: SnapshotCommitWorkerFactory = createNativeSnapshotCommitWorkerFactory(),
  ) {
    this.#repository = repository;
    this.#factory = factory;
  }

  async commit(
    request: SnapshotCommitRequest,
    owner: Extract<
      ArtifactLeaseOwner,
      { kind: "manual-draft" | "magic-draft" | "background-draft" | "run" }
    >,
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
      throw new Error("Snapshot commit artifacts are unavailable");
    }
    const sourceBytes = await transferableBytes(sourceValue);
    const foreground = await this.#encodedArtifact(request.foreground ?? null);
    const background = await this.#background(request.background);
    const matte = matteValue.slice().buffer;
    if (signal.aborted) throw cancelledError();
    const worker = this.#factory.create();
    return new Promise<DocumentSnapshot>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        signal.removeEventListener("abort", abortFx);
        worker.removeEventListener("message", messageFx);
        worker.removeEventListener("error", crashFx);
        worker.removeEventListener("messageerror", crashFx);
        worker.terminate();
      };
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const abortFx = (): void => fail(cancelledError());
      const crashFx = (event: Event): void => {
        const message =
          "message" in event && typeof event.message === "string"
            ? event.message
            : "Snapshot commit worker crashed";
        fail(new Error(message));
      };
      const messageFx = (event: MessageEvent<unknown>): void => {
        if (!isSnapshotCommitWorkerEvent(event.data)) {
          fail(new Error("Invalid snapshot commit worker event"));
          return;
        }
        if (!sameSnapshotCommitCorrelation(event.data.correlation, request)) return;
        if (event.data.type === "FAILED") return fail(new Error(event.data.message));
        try {
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
          settled = true;
          cleanup();
          resolve({
            matte: request.draftMatte,
            foreground: request.foreground ?? null,
            composite,
            background: request.background,
          });
        } catch (error) {
          fail(
            error instanceof Error ? error : new Error("Snapshot registration failed"),
          );
        }
      };
      signal.addEventListener("abort", abortFx, { once: true });
      worker.addEventListener("message", messageFx);
      worker.addEventListener("error", crashFx);
      worker.addEventListener("messageerror", crashFx);
      try {
        worker.postMessage(
          {
            protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
            type: "MATERIALIZE_SNAPSHOT",
            correlation: request,
            source: {
              bytes: sourceBytes,
              mediaType: encodedMediaType(sourceMetadata.mediaType),
            },
            foreground,
            background,
            matte,
            width: matteMetadata.width,
            height: matteMetadata.height,
          },
          [
            sourceBytes,
            matte,
            ...(foreground === null ? [] : [foreground.bytes]),
            ...(background.type === "image" ? [background.bytes] : []),
          ],
        );
      } catch (error) {
        fail(
          error instanceof Error ? error : new Error("Snapshot commit failed to start"),
        );
      }
    });
  }

  async #encodedArtifact(
    artifactId: ArtifactId | null,
  ): Promise<SnapshotCommitWorkerImage | null> {
    if (artifactId === null) return null;
    const value = this.#repository.read(artifactId);
    const metadata = this.#repository.metadata(artifactId);
    if (value === null || metadata === null || !(value instanceof Blob)) {
      throw new Error("Snapshot foreground artifact is unavailable");
    }
    return {
      bytes: await transferableBytes(value),
      mediaType: encodedMediaType(metadata.mediaType),
    };
  }

  async #background(
    descriptor: DocumentSnapshot["background"],
  ): Promise<SnapshotCommitWorkerBackground> {
    if (descriptor.type !== "image") return descriptor;
    const image = await this.#encodedArtifact(descriptor.artifactId);
    if (image === null) throw new Error("Snapshot background artifact is unavailable");
    return { type: "image", ...image };
  }
}
