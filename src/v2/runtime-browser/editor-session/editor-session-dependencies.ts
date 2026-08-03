import { ArtifactRepository } from "../artifacts";
import { ManualDraftRepository, WorkerManualCutoutCommitter } from "../manual-cutout";
import {
  createNativeMagicWorkerFactory,
  MagicCandidateRepository,
  MagicDraftRepository,
  MagicWorkerClient,
  WorkerMagicCutoutCommitter,
} from "../magic-cutout";
import { createNativeDownloadAdapter, createNativeEditorIdSource } from "../platform";
import {
  createLocalModelConfig,
  createNativeProcessingWorkerFactory,
  detectBrowserProcessingCapabilities,
  LocalProcessingGateway,
  HeavyJobCoordinator,
  WorkerProcessingExecutor,
} from "../processing";
import { WorkerSnapshotCommitter } from "../snapshot-commit";
import type {
  EditorSessionDependencies,
  EditorSessionOptions,
} from "./editor-session.types";

export function createEditorSessionDependencies(
  options: EditorSessionOptions,
): EditorSessionDependencies {
  const ids = options.ids ?? createNativeEditorIdSource();
  const repository =
    options.repository ??
    new ArtifactRepository({
      assertions: "throw",
      idSource: { next: ids.artifact },
      memoryBudgetBytes: 512 * 1024 * 1024,
    });
  const heavyJobs = new HeavyJobCoordinator();
  const snapshotCommitter =
    options.snapshotCommitter ?? new WorkerSnapshotCommitter(repository);
  const gateway =
    options.gateway ??
    new LocalProcessingGateway(
      new WorkerProcessingExecutor({
        factory: createNativeProcessingWorkerFactory(),
        model: createLocalModelConfig(
          detectBrowserProcessingCapabilities().webGpu === "supported"
            ? "webgpu"
            : "wasm",
        ),
        repository,
      }),
      heavyJobs,
    );
  const magicCandidates =
    options.magicCandidates ?? new MagicCandidateRepository(ids.magicCandidate);
  return {
    download: options.download ?? createNativeDownloadAdapter(),
    gateway,
    ids,
    repository,
    heavyJobs,
    magicCandidates,
    magicCommitter:
      options.magicCommitter ??
      new WorkerMagicCutoutCommitter({
        candidates: magicCandidates,
        repository,
        snapshots: snapshotCommitter,
      }),
    magicDrafts: options.magicDrafts ?? new MagicDraftRepository(),
    magicWorker:
      options.magicWorker ??
      new MagicWorkerClient({
        coordinator: heavyJobs,
        factory: createNativeMagicWorkerFactory(),
        repository,
      }),
    manualCommitter:
      options.manualCommitter ??
      new WorkerManualCutoutCommitter(repository, snapshotCommitter),
    manualDrafts: options.manualDrafts ?? new ManualDraftRepository(),
    snapshotCommitter,
  };
}
