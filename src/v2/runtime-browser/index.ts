export {
  ArtifactRepository,
  ArtifactRepositoryError,
  createNativeArtifactIdSource,
  createNativeArtifactUrlAdapter,
} from "./artifacts";
export type {
  ArtifactIdSource,
  ArtifactObjectUrl,
  ArtifactRegistration,
  ArtifactRepositoryOptions,
  ArtifactUrlAdapter,
  ArtifactValue,
} from "./artifacts";
export { createEditorSession } from "./editor-session";
export type {
  ActiveEditorSessionSnapshot,
  EditorImportError,
  EditorSession,
  EditorSessionOptions,
  EditorSessionSnapshot,
} from "./editor-session";
export {
  MANUAL_DRAFT_PATCH_LIMIT,
  ManualDraftEngine,
  ManualDraftRepository,
  loadManualSourceBitmap,
  installManualDraftUnloadGuard,
} from "./manual-cutout";
export type {
  ManualCutoutBox,
  ManualCutoutBrush,
  ManualCutoutPatch,
  ManualCutoutPoint,
} from "./manual-cutout";
export {
  MAGIC_STROKE_LIMIT,
  MAGIC_STROKE_POINT_LIMIT,
  MagicDraftEngine,
  MagicDraftRepository,
} from "./magic-cutout";
export type {
  MagicDraftSnapshot,
  MagicRuntimeProgress,
  MagicPoint,
  MagicStroke,
  MagicStrokeStart,
} from "./magic-cutout";
export {
  createNativeDownloadAdapter,
  createNativeEditorIdSource,
  createNativeProcessingCancellationSource,
} from "./platform";
export type { DownloadAdapter, EditorIdSource } from "./platform";
export {
  createLocalModelConfig,
  createNativeProcessingWorkerFactory,
  detectBrowserProcessingCapabilities,
  LocalProcessingGateway,
  HeavyJobCoordinator,
  PROCESSING_WORKER_PROTOCOL_VERSION,
  resolveUsableInferencePath,
  sameCorrelation,
  WorkerProcessingExecutor,
} from "./processing";
export type {
  BrowserCapabilitySource,
  LocalModelConfig,
  LocalProcessingExecutor,
  HeavyJobKind,
  HeavyJobRequest,
  ProcessingWorker,
  ProcessingWorkerCommand,
  ProcessingWorkerEvent,
  ProcessingWorkerFactory,
  StageTiming,
  TransferableArtifactSet,
  TransferableSourceArtifact,
  WebGpuProbeSource,
} from "./processing";
