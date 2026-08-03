import { ArtifactRepository } from "../artifacts";
import {
  BackgroundDraftRepository,
  BackgroundImageClient,
  WorkerBackgroundCommitter,
} from "../background";
import {
  createNativeEnhancementWorkerFactory,
  EnhancementCommitService,
  EnhancementDraftRepository,
  EnhancementWorkerClient,
} from "../enhancements";
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
  const capabilities = detectBrowserProcessingCapabilities();
  const inferencePath =
    capabilities.webGpu === "supported" ? ("webgpu" as const) : ("wasm" as const);
  const snapshotCommitter =
    options.snapshotCommitter ?? new WorkerSnapshotCommitter(repository);
  const gateway =
    options.gateway ??
    new LocalProcessingGateway(
      new WorkerProcessingExecutor({
        factory: createNativeProcessingWorkerFactory(),
        model: createLocalModelConfig(inferencePath),
        repository,
      }),
      heavyJobs,
    );
  const magicCandidates =
    options.magicCandidates ?? new MagicCandidateRepository(ids.magicCandidate);
  const backgroundDrafts =
    options.backgroundDrafts ?? new BackgroundDraftRepository(repository);
  const enhancementDrafts =
    options.enhancementDrafts ?? new EnhancementDraftRepository(repository);
  const enhancementService =
    options.enhancementService ??
    new EnhancementCommitService({
      artifacts: repository,
      coordinator: heavyJobs,
      drafts: enhancementDrafts,
      requestedMode: () => (inferencePath === "webgpu" ? "maximum" : "balanced"),
      requestedPath: () => inferencePath,
      snapshots: snapshotCommitter,
      worker: new EnhancementWorkerClient(createNativeEnhancementWorkerFactory()),
    });
  return {
    backgroundCommitter:
      options.backgroundCommitter ?? new WorkerBackgroundCommitter(snapshotCommitter),
    backgroundDrafts,
    backgroundImages: options.backgroundImages ?? new BackgroundImageClient(),
    download: options.download ?? createNativeDownloadAdapter(),
    gateway,
    enhancementDrafts,
    enhancementService,
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
