import type {
  BackgroundCommitter,
  DocumentActorRef,
  MagicCutoutCommitter,
  MagicCutoutPredictor,
  ProcessingGateway,
} from "@/v2/application";
import type {
  ArtifactRepositoryStats,
  BackgroundFillDescriptor,
  EnhancementOperationId,
  MagicCandidateId,
  DocumentId,
  ProcessingError,
  WorkspaceItemId,
  ManualCutoutMode,
  MagicCutoutMode,
} from "@/v2/domain";
import type { AutomaticModelMode } from "@/shared/lib";
import type { ExportSize } from "@/v2/domain";
import type { BrowserInferencePath } from "@/shared/lib";

import type { ArtifactRepository } from "../artifacts";
import type {
  BackgroundDraftRepository,
  BackgroundImagePreparer,
  BackgroundRuntimeSnapshot,
} from "../background";
import type {
  EnhancementDraftRepository,
  EnhancementRuntimeService,
  EnhancementRuntimeSnapshot,
} from "../enhancements";
import type { ManualDraftEngine, ManualDraftRepository } from "../manual-cutout";
import type {
  MagicCandidateRepository,
  MagicDraftEngine,
  MagicRuntimeProgress,
  MagicDraftRepository,
  MagicWorkerClient,
} from "../magic-cutout";
import type { ManualCutoutCommitter } from "@/v2/application";
import type { DownloadAdapter, EditorIdSource } from "../platform";
import type { HeavyJobCoordinator } from "../processing";
import type { SnapshotCommitter } from "../snapshot-commit";

export type EditorImportError =
  "unsupported-file" | "exceeds-size-limit" | "invalid-image" | "preparation-failed";

export type EmptyEditorSessionSnapshot = {
  kind: "empty";
  actor: null;
  error: EditorImportError | null;
  fileName: null;
  height: null;
  previewUrl: null;
  resultUrl: null;
  width: null;
};

export type PreparingEditorSessionSnapshot = {
  kind: "preparing";
  actor: null;
  error: null;
  fileName: string;
  height: null;
  previewUrl: null;
  resultUrl: null;
  width: null;
};

export type ActiveEditorSessionSnapshot = {
  kind: "document";
  actor: DocumentActorRef;
  error: null;
  fileName: string;
  foregroundUrl: string | null;
  height: number;
  backgroundRuntime: BackgroundRuntimeSnapshot;
  enhancementRuntime: EnhancementRuntimeSnapshot;
  magicProgress: MagicRuntimeProgress | null;
  previewUrl: string | null;
  resultUrl: string | null;
  width: number;
};

export type EditorSessionSnapshot =
  | EmptyEditorSessionSnapshot
  | PreparingEditorSessionSnapshot
  | ActiveEditorSessionSnapshot;

export type WorkspaceItemStatus =
  "preparing" | "queued" | "model-loading" | "processing" | "result" | "error";

export type WorkspaceItemSummary = Readonly<{
  itemId: WorkspaceItemId;
  documentId: DocumentId | null;
  fileName: string;
  status: WorkspaceItemStatus;
  error: ProcessingError | EditorImportError | null;
  previewUrl: string | null;
  queuePosition: number | null;
  qualityMode: AutomaticModelMode;
}>;

export type BatchExportSnapshot = Readonly<{
  status: "idle" | "preparing" | "downloading" | "cancelled" | "error";
  includedCount: number;
  skippedCount: number;
  error: string | null;
}>;

export type SingleExportSnapshot = Readonly<{
  status: "idle" | "preparing" | "succeeded" | "cancelled" | "error";
  error: string | null;
  size: ExportSize | null;
}>;

export type AutomaticProcessingSelection = Readonly<{
  effectiveMode: AutomaticModelMode;
  fallbackUsed: boolean;
  inferencePath: BrowserInferencePath;
  requestedMode: AutomaticModelMode;
}>;

export type EditorWorkspaceSnapshot = Readonly<{
  itemIds: readonly WorkspaceItemId[];
  selectedDocumentId: DocumentId | null;
  items: readonly WorkspaceItemSummary[];
  export: BatchExportSnapshot;
}>;

export type EditorSession = {
  applyBackground(): void;
  applyEnhancements(): void;
  beginBackground(): void;
  beginEnhancements(): void;
  beginMagic(): void;
  beginManual(): void;
  applyMagic(): void;
  applyManual(): void;
  cancelMagic(): void;
  cancelManual(): void;
  cancelBackground(): void;
  cancelEnhancements(): void;
  cancel(): void;
  cancelExportAll(): void;
  changeBackground(fill: BackgroundFillDescriptor): void;
  changeEnhancements(operationIds: readonly EnhancementOperationId[]): void;
  dispose(): Promise<void>;
  exportPng(size?: ExportSize): Promise<void>;
  singleExportSnapshot(): SingleExportSnapshot;
  exportAll(): Promise<void>;
  exportItemPng(documentId: DocumentId): void;
  getSnapshot(): EditorSessionSnapshot;
  importImage(file: File, modelMode?: AutomaticModelMode): Promise<void>;
  importImages(files: readonly File[], modelMode?: AutomaticModelMode): Promise<void>;
  manualDraft(): ManualDraftEngine | null;
  manualViewState(): Readonly<{
    mode: ManualCutoutMode;
    brushSize: number;
    zoom: number;
  }>;
  setManualViewState(
    state: Readonly<{ mode: ManualCutoutMode; brushSize: number; zoom: number }>,
  ): void;
  magicDraft(): MagicDraftEngine | null;
  magicViewState(): Readonly<{ mode: MagicCutoutMode; radius: number }>;
  setMagicViewState(state: Readonly<{ mode: MagicCutoutMode; radius: number }>): void;
  notifyMagicChanged(): void;
  paintMagicCandidate(
    canvas: HTMLCanvasElement,
    candidateId: MagicCandidateId | null,
  ): void;
  notifyManualDirty(): void;
  undoManual(): void;
  redoManual(): void;
  undoMagic(): void;
  redoMagic(): void;
  predictMagic(): void;
  selectMagicCandidate(candidateId: MagicCandidateId): void;
  undoDocument(): void;
  redoDocument(): void;
  resources(): ArtifactRepositoryStats;
  processingSelection(): AutomaticProcessingSelection | null;
  reset(): void;
  removeItem(itemId: WorkspaceItemId): void;
  retryItem(itemId: WorkspaceItemId): Promise<void>;
  selectDocument(documentId: DocumentId): void;
  retry(modelMode?: AutomaticModelMode): void;
  retryEnhancements(): void;
  selectBackgroundImage(file: File): Promise<void>;
  subscribe(listener: () => void): () => void;
  subscribeActive(listener: () => void): () => void;
  workspaceSnapshot(): EditorWorkspaceSnapshot;
};

export type EditorSessionOptions = {
  backgroundCommitter?: BackgroundCommitter;
  backgroundDrafts?: BackgroundDraftRepository;
  backgroundImages?: BackgroundImagePreparer;
  download?: DownloadAdapter;
  gateway?: ProcessingGateway;
  ids?: EditorIdSource;
  enhancementDrafts?: EnhancementDraftRepository;
  enhancementService?: EnhancementRuntimeService;
  repository?: ArtifactRepository;
  manualCommitter?: ManualCutoutCommitter;
  manualDrafts?: ManualDraftRepository;
  magicCandidates?: MagicCandidateRepository;
  magicCommitter?: MagicCutoutCommitter;
  magicDrafts?: MagicDraftRepository;
  magicPredictor?: MagicCutoutPredictor;
  magicWorker?: MagicWorkerClient;
  snapshotCommitter?: SnapshotCommitter;
};

export type EditorSessionDependencies = {
  backgroundCommitter: BackgroundCommitter;
  backgroundDrafts: BackgroundDraftRepository;
  backgroundImages: BackgroundImagePreparer;
  download: DownloadAdapter;
  gateway: ProcessingGateway;
  ids: EditorIdSource;
  enhancementDrafts: EnhancementDraftRepository;
  enhancementService: EnhancementRuntimeService;
  enhancementServiceFor(documentId: DocumentId): EnhancementRuntimeService;
  releaseEnhancementService(documentId: DocumentId): void;
  disposeEnhancementServices(): void;
  repository: ArtifactRepository;
  manualCommitter: ManualCutoutCommitter;
  manualDrafts: ManualDraftRepository;
  magicCandidates: MagicCandidateRepository;
  magicCommitter: MagicCutoutCommitter;
  magicDrafts: MagicDraftRepository;
  magicWorker: MagicWorkerClient;
  snapshotCommitter: SnapshotCommitter;
  heavyJobs: HeavyJobCoordinator;
};
