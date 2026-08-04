export type {
  ArtifactKind,
  ArtifactLease,
  ArtifactLeaseOwner,
  ArtifactMediaType,
  ArtifactMetadata,
  ArtifactRepositoryStats,
} from "./artifacts";
export {
  changeBackgroundDraft,
  normalizeBackgroundFill,
  normalizeHexColor,
  sameBackgroundFill,
  TRANSPARENT_BACKGROUND,
} from "./background";
export type {
  BackgroundDraft,
  BackgroundDraftStatus,
  BackgroundFillDescriptor,
  BackgroundGradientStop,
  HexColor,
} from "./background";
export type {
  BrowserProcessingCapabilities,
  CapabilitySupport,
  LocalInferencePath,
} from "./capabilities";
export type {
  ApplyManualCutoutCommand,
  ApplyMagicCutoutCommand,
  ApplyBackgroundCommand,
  ApplyEnhancementsCommand,
  BeginBackgroundCommand,
  BeginEnhancementsCommand,
  BeginMagicCutoutCommand,
  BeginManualCutoutCommand,
  CancelActiveRunCommand,
  CancelManualCutoutCommand,
  CancelMagicCutoutCommand,
  CancelBackgroundCommand,
  CancelEnhancementsCommand,
  ChangeBackgroundCommand,
  ChangeEnhancementsCommand,
  CommandOutcome,
  CommandRejectionReason,
  DocumentCommand,
  EditorCommandType,
  ExportPngCommand,
  MagicDraftChangedCommand,
  PredictMagicCutoutCommand,
  ResetDocumentCommand,
  RedoDocumentCommand,
  StartAutomaticRemovalCommand,
  SelectMagicCandidateCommand,
  UndoDocumentCommand,
  WorkspaceCommand,
  WorkspaceCommandOutcome,
} from "./commands";
export type {
  ActiveRun,
  ActiveToolDraft,
  ActiveMagicPrediction,
  DocumentSnapshot,
  DocumentState,
  DocumentStatus,
  PendingCommit,
  PendingManualCommit,
  PendingMagicCommit,
  PendingBackgroundCommit,
  PendingEnhancementCommit,
} from "./document";
export type {
  CommitEvent,
  DocumentEvent,
  DocumentLifecycleEvent,
  ExportEvent,
  PreparationEvent,
  ProcessingLifecycleEvent,
  ManualCutoutEvent,
  MagicCutoutEvent,
  BackgroundEvent,
  EnhancementEvent,
  SourceRegisteredEvent,
} from "./events";
export type { ExportSize } from "./export";
export {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
  createEditOperationId,
  createEnhancementDraftId,
  createImageId,
  createMagicCandidateId,
  createMagicDraftId,
  createManualDraftId,
  createRunId,
  createWorkspaceItemId,
  isRevision,
} from "./ids";
export type {
  ArtifactId,
  BackgroundDraftId,
  DocumentId,
  EditOperationId,
  EnhancementDraftId,
  ImageId,
  MagicCandidateId,
  MagicDraftId,
  ManualDraftId,
  Revision,
  RunId,
  WorkspaceItemId,
} from "./ids";
export {
  changeEnhancementDraft,
  enhancementOperation,
  ENHANCEMENT_OPERATION_ORDER,
  ENHANCEMENT_OPERATION_REGISTRY,
  orderEnhancementOperations,
} from "./enhancements";
export type {
  EnhancementDraft,
  EnhancementDraftStatus,
  EnhancementExecutionAdapter,
  EnhancementOperationDefinition,
  EnhancementOperationId,
} from "./enhancements";
export {
  clearDocumentHistory,
  commitDocumentHistory,
  createEmptyDocumentHistory,
  DOCUMENT_HISTORY_BYTE_LIMIT,
  DOCUMENT_HISTORY_ENTRY_LIMIT,
  redoDocumentHistory,
  undoDocumentHistory,
} from "./document-history";
export {
  advanceMagicDraftRevision,
  createMagicCutoutDraft,
  matchesMagicPrediction,
} from "./magic-cutout";
export type {
  MagicCandidateSummary,
  MagicCutoutDraft,
  MagicCutoutMode,
  MagicCutoutStatus,
  MagicPredictionCorrelation,
} from "./magic-cutout";
export type {
  DocumentHistory,
  DocumentHistoryChange,
  DocumentHistoryEntry,
  DocumentHistoryMove,
  ManualCutoutDraft,
  ManualCutoutMode,
} from "./document-history";
export { isProcessingErrorCode, isProcessingTerminalEvent } from "./processing";
export type {
  ProcessingBackend,
  ProcessingError,
  ProcessingErrorCode,
  ProcessingProgress,
  ProcessingRequest,
  ProcessingStage,
  ProcessingTerminalEvent,
  RunCorrelation,
} from "./processing";
export { decideDocumentCommand, transitionDocument } from "./document-transition";
export type {
  DocumentCommandEnvelope,
  DocumentDecision,
  DocumentEffect,
  DocumentTransition,
} from "./document-transition";
