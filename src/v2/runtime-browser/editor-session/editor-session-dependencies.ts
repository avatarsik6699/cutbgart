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
import type { DocumentId } from "@/v2/domain";
import type { ProcessingRequest } from "@/v2/domain";
import type { AutomaticModelMode, BrowserInferencePath } from "@/shared/lib";
import type { EditorSessionTypes } from "./editor-session.types";

export function createEditorSessionDependencies(
  options: EditorSessionTypes.Options,
  runtimeEvents?: Readonly<{
    onExecutionSelected(
      request: ProcessingRequest,
      selection: Readonly<{
        inferencePath: BrowserInferencePath;
        modelMode: AutomaticModelMode;
      }>,
    ): void;
  }>,
): EditorSessionTypes.Dependencies {
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
        onExecutionSelected: runtimeEvents?.onExecutionSelected,
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
  const enhancementWorker =
    options.enhancementService === undefined
      ? new EnhancementWorkerClient(createNativeEnhancementWorkerFactory())
      : null;
  const enhancementServices = new Map<DocumentId, EnhancementCommitService>();
  function enhancementServiceFor(documentId: DocumentId) {
    if (options.enhancementService !== undefined) return options.enhancementService;
    const existing = enhancementServices.get(documentId);
    if (existing !== undefined) return existing;
    const service = new EnhancementCommitService({
      artifacts: repository,
      coordinator: heavyJobs,
      drafts: enhancementDrafts,
      requestedMode: () => (inferencePath === "webgpu" ? "maximum" : "balanced"),
      requestedPath: () => inferencePath,
      snapshots: snapshotCommitter,
      worker: enhancementWorker!,
      ownsWorker: false,
    });
    enhancementServices.set(documentId, service);
    return service;
  }
  const enhancementService = options.enhancementService ?? {
    commit(input, signal) {
      return enhancementServiceFor(input.documentId).commit(input, signal);
    },
    dispose() {},
    getSnapshot: () => ({
      status: "ready" as const,
      activeOperationId: null,
      fraction: null,
      error: null,
    }),
    reportError() {},
    reset() {},
    subscribe: () => () => undefined,
  };
  return {
    backgroundCommitter:
      options.backgroundCommitter ?? new WorkerBackgroundCommitter(snapshotCommitter),
    backgroundDrafts,
    backgroundImages: options.backgroundImages ?? new BackgroundImageClient(),
    download: options.download ?? createNativeDownloadAdapter(),
    gateway,
    enhancementDrafts,
    enhancementService,
    enhancementServiceFor,
    releaseEnhancementService(documentId) {
      if (options.enhancementService !== undefined) return;
      enhancementServices.get(documentId)?.dispose();
      enhancementServices.delete(documentId);
    },
    disposeEnhancementServices() {
      for (const service of new Set(enhancementServices.values())) service.dispose();
      enhancementServices.clear();
      enhancementWorker?.dispose();
      options.enhancementService?.dispose();
    },
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
