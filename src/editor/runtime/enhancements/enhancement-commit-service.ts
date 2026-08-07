import type {
  EnhancementCommitInput,
  EnhancementCommitResult,
  EnhancementCommitter,
} from "@/editor/application";
import {
  orderEnhancementOperations,
  sameBackgroundFill,
  type ArtifactId,
  type EnhancementTypes,
  type LocalInferencePath,
} from "@/editor/domain";

import type { ArtifactRepository } from "../artifacts";
import type { HeavyJobCoordinator } from "../processing";
import type { SnapshotCommitter } from "../snapshot-commit";
import type { EnhancementDraftRepository } from "./enhancement-draft-repository";
import type {
  EnhancementOperationRunner,
  EnhancementWorkerProgress,
} from "./enhancement-worker-client";

export type EnhancementRuntimeSnapshot = Readonly<{
  status: "ready" | "queued" | "running" | "applying" | "no-change" | "error";
  activeOperationId: EnhancementTypes.OperationId | null;
  fraction: number | null;
  error: string | null;
}>;

export type EnhancementRuntimeService = EnhancementCommitter & {
  getSnapshot(): EnhancementRuntimeSnapshot;
  subscribe(listener: () => void): () => void;
  reset(): void;
  reportError(error: unknown): void;
  dispose(): void;
};

const READY_SNAPSHOT = Object.freeze({
  status: "ready",
  activeOperationId: null,
  fraction: null,
  error: null,
}) satisfies EnhancementRuntimeSnapshot;

function sameIds(
  input: EnhancementCommitInput,
  baseline: NonNullable<ReturnType<EnhancementDraftRepository["get"]>>,
): boolean {
  return (
    input.documentId === baseline.documentId &&
    input.draftId === baseline.draftId &&
    input.expectedRevision === baseline.baselineRevision &&
    input.source === baseline.source &&
    input.snapshot.matte === baseline.snapshot.matte &&
    input.snapshot.foreground === baseline.snapshot.foreground &&
    input.snapshot.composite === baseline.snapshot.composite &&
    sameBackgroundFill(input.snapshot.background, baseline.snapshot.background)
  );
}

async function sameMatte(
  left: Uint8ClampedArray,
  right: Uint8ClampedArray,
  signal: AbortSignal,
): Promise<boolean> {
  if (left.length !== right.length) return false;
  const chunkSize = 256 * 1024;
  for (let start = 0; start < left.length; start += chunkSize) {
    if (signal.aborted) throw abortError();
    const end = Math.min(left.length, start + chunkSize);
    for (let index = start; index < end; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    if (end < left.length) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
    }
  }
  return true;
}

function abortError(): DOMException {
  return new DOMException("Enhancement run was cancelled", "AbortError");
}

export class EnhancementCommitService implements EnhancementRuntimeService {
  readonly #artifacts: ArtifactRepository;
  readonly #coordinator: HeavyJobCoordinator;
  readonly #drafts: EnhancementDraftRepository;
  readonly #listeners = new Set<() => void>();
  readonly #requestedMode: () => "balanced" | "maximum";
  readonly #requestedPath: () => LocalInferencePath;
  readonly #snapshots: SnapshotCommitter;
  readonly #worker: EnhancementOperationRunner;
  readonly #ownsWorker: boolean;
  #snapshot: EnhancementRuntimeSnapshot = READY_SNAPSHOT;

  constructor(options: {
    artifacts: ArtifactRepository;
    coordinator: HeavyJobCoordinator;
    drafts: EnhancementDraftRepository;
    requestedMode?: () => "balanced" | "maximum";
    requestedPath: () => LocalInferencePath;
    snapshots: SnapshotCommitter;
    worker: EnhancementOperationRunner;
    ownsWorker?: boolean;
  }) {
    this.#artifacts = options.artifacts;
    this.#coordinator = options.coordinator;
    this.#drafts = options.drafts;
    this.#requestedMode = options.requestedMode ?? (() => "balanced");
    this.#requestedPath = options.requestedPath;
    this.#snapshots = options.snapshots;
    this.#worker = options.worker;
    this.#ownsWorker = options.ownsWorker ?? true;
  }

  getSnapshot = (): EnhancementRuntimeSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async commit(
    input: EnhancementCommitInput,
    signal: AbortSignal,
  ): Promise<EnhancementCommitResult> {
    const baseline = this.#drafts.get(input.draftId);
    const pixels = this.#drafts.pixels(input.draftId);
    const operationIds = orderEnhancementOperations(input.operationIds);
    if (
      baseline === null ||
      pixels === null ||
      !sameIds(input, baseline) ||
      operationIds.length === 0
    ) {
      throw new Error("Enhancement draft baseline is unavailable or stale");
    }
    let currentMatte = pixels.matte;
    let currentForeground = pixels.foreground;
    try {
      for (const operationId of operationIds) {
        if (signal.aborted) throw abortError();
        this.#publish({
          status: "queued",
          activeOperationId: operationId,
          fraction: null,
          error: null,
        });
        const result = await this.#coordinator.schedule({
          kind: "enhancement",
          signal,
          execute: (admittedSignal) => {
            this.#publish({
              status: "running",
              activeOperationId: operationId,
              fraction: null,
              error: null,
            });
            return this.#worker.run(
              {
                documentId: input.documentId,
                draftId: input.draftId,
                runId: input.runId,
                expectedRevision: input.expectedRevision,
                operationId,
                source:
                  operationId === "colour-halo" && currentForeground !== null
                    ? currentForeground
                    : pixels.source,
                matte: currentMatte,
                width: baseline.width,
                height: baseline.height,
                requestedMode: this.#requestedMode(),
                requestedPath: this.#requestedPath(),
              },
              admittedSignal,
              (progress) => this.#progress(operationId, progress),
            );
          },
        });
        currentMatte = result.matte;
        if (result.operationId === "colour-halo" && result.foreground !== null)
          currentForeground = result.foreground;
      }
      if (signal.aborted) throw abortError();
      const matteChanged = !(await sameMatte(pixels.matte, currentMatte, signal));
      const foregroundChanged = currentForeground !== pixels.foreground;
      if (!matteChanged && !foregroundChanged) {
        this.#publish({
          status: "no-change",
          activeOperationId: null,
          fraction: null,
          error: null,
        });
        return { outcome: "unchanged" };
      }
      this.#publish({
        status: "applying",
        activeOperationId: null,
        fraction: null,
        error: null,
      });
      const runOwner = {
        kind: "run",
        documentId: input.documentId,
        runId: input.runId,
      } as const;
      const introduced: ArtifactId[] = [];
      try {
        const matteArtifact = matteChanged
          ? this.#artifacts.register(
              currentMatte,
              {
                kind: "matte",
                mediaType: "application/octet-stream",
                width: baseline.width,
                height: baseline.height,
                estimatedBytes: currentMatte.byteLength,
              },
              runOwner,
            )
          : baseline.snapshot.matte;
        if (matteChanged) introduced.push(matteArtifact);
        const foregroundArtifact = foregroundChanged
          ? this.#artifacts.register(
              currentForeground!,
              {
                kind: "foreground",
                mediaType: "image/png",
                width: baseline.width,
                height: baseline.height,
                estimatedBytes: currentForeground!.size,
              },
              runOwner,
            )
          : baseline.snapshot.foreground;
        if (foregroundChanged && foregroundArtifact !== null)
          introduced.push(foregroundArtifact);
        const snapshot = await this.#snapshots.commit(
          {
            automaticModelMode: input.snapshot.automaticModelMode,
            documentId: input.documentId,
            draftId: input.draftId,
            runId: input.runId,
            expectedRevision: input.expectedRevision,
            operation: "enhancement",
            source: input.source,
            draftMatte: matteArtifact,
            foreground: foregroundArtifact,
            background: input.snapshot.background,
          },
          runOwner,
          signal,
        );
        introduced.push(snapshot.composite);
        const promoted = this.#artifacts.promote(introduced, runOwner, {
          kind: "enhancement-draft",
          documentId: input.documentId,
          draftId: input.draftId,
        });
        if (!promoted) throw new Error("Could not promote enhancement artifacts");
        this.#publish(READY_SNAPSHOT);
        return { outcome: "changed", snapshot };
      } catch (error) {
        this.#artifacts.releaseOwnerIfPresent(runOwner);
        throw error;
      }
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        this.#publish(READY_SNAPSHOT);
        throw abortError();
      }
      this.#publish({
        status: "error",
        activeOperationId: this.#snapshot.activeOperationId,
        fraction: null,
        error: error instanceof Error ? error.message : "Enhancement run failed",
      });
      throw error;
    }
  }

  reset(): void {
    if (this.#ownsWorker) this.#worker.reset();
    this.#publish(READY_SNAPSHOT);
  }

  reportError(error: unknown): void {
    this.#publish({
      status: "error",
      activeOperationId: null,
      fraction: null,
      error: error instanceof Error ? error.message : "Enhancement setup failed",
    });
  }

  dispose(): void {
    if (this.#ownsWorker) this.#worker.dispose();
    this.#listeners.clear();
    this.#snapshot = READY_SNAPSHOT;
  }

  #progress(
    operationId: EnhancementTypes.OperationId,
    progress: EnhancementWorkerProgress,
  ): void {
    this.#publish({
      status: "running",
      activeOperationId: operationId,
      fraction: progress.fraction,
      error: null,
    });
  }

  #publish(snapshot: EnhancementRuntimeSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}
