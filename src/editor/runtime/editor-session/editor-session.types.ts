import type {
  BackgroundCommitter,
  DocumentMachineTypes,
  MagicCutoutCommitter,
  MagicCutoutPredictor,
  ProcessingGateway,
} from "@/editor/application";
import type {
  ArtifactRepositoryStats,
  BackgroundTypes,
  EnhancementTypes,
  MagicCandidateId,
  DocumentId,
  ProcessingError,
  WorkspaceItemId,
  DocumentHistoryTypes,
  MagicCutoutTypes,
} from "@/editor/domain";
import type { AutomaticModelMode } from "@/shared/lib";
import type { ExportSize } from "@/editor/domain";
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
import type { ManualCutoutCommitter } from "@/editor/application";
import type { DownloadAdapter, EditorIdSource } from "../platform";
import type { HeavyJobCoordinator } from "../processing";
import type { SnapshotCommitter } from "../snapshot-commit";

export declare namespace EditorSessionTypes {
  type ImportError =
    "unsupported-file" | "exceeds-size-limit" | "invalid-image" | "preparation-failed";

  type EmptySnapshot = {
    kind: "empty";
    actor: null;
    error: ImportError | null;
    fileName: null;
    height: null;
    previewUrl: null;
    resultUrl: null;
    width: null;
  };

  type PreparingSnapshot = {
    kind: "preparing";
    actor: null;
    error: null;
    fileName: string;
    height: null;
    previewUrl: null;
    resultUrl: null;
    width: null;
  };

  type ActiveSnapshot = {
    kind: "document";
    actor: DocumentMachineTypes.ActorRef;
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

  type Snapshot = EmptySnapshot | PreparingSnapshot | ActiveSnapshot;

  type ItemStatus =
    "preparing" | "queued" | "model-loading" | "processing" | "result" | "error";

  type ItemSummary = Readonly<{
    itemId: WorkspaceItemId;
    documentId: DocumentId | null;
    fileName: string;
    status: ItemStatus;
    error: ProcessingError | ImportError | null;
    previewUrl: string | null;
    queuePosition: number | null;
    qualityMode: AutomaticModelMode;
  }>;

  type BatchExportSnapshot = Readonly<{
    status: "idle" | "preparing" | "downloading" | "cancelled" | "error";
    includedCount: number;
    skippedCount: number;
    error: string | null;
  }>;

  type SingleExportSnapshot = Readonly<{
    status: "idle" | "preparing" | "succeeded" | "cancelled" | "error";
    error: string | null;
    size: ExportSize | null;
  }>;

  type ProcessingSelection = Readonly<{
    effectiveMode: AutomaticModelMode;
    fallbackUsed: boolean;
    inferencePath: BrowserInferencePath;
    requestedMode: AutomaticModelMode;
  }>;

  type WorkspaceSnapshot = Readonly<{
    itemIds: readonly WorkspaceItemId[];
    selectedDocumentId: DocumentId | null;
    items: readonly ItemSummary[];
    export: BatchExportSnapshot;
  }>;

  type Session = {
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
    changeBackground(fill: BackgroundTypes.FillDescriptor): void;
    changeEnhancements(operationIds: readonly EnhancementTypes.OperationId[]): void;
    dispose(): Promise<void>;
    exportPng(size?: ExportSize): Promise<void>;
    singleExportSnapshot(): SingleExportSnapshot;
    exportAll(): Promise<void>;
    exportItemPng(documentId: DocumentId): void;
    getSnapshot(): Snapshot;
    importImage(file: File, modelMode?: AutomaticModelMode): Promise<void>;
    importImages(files: readonly File[], modelMode?: AutomaticModelMode): Promise<void>;
    manualDraft(): ManualDraftEngine | null;
    manualViewState(): Readonly<{
      mode: DocumentHistoryTypes.ManualMode;
      brushSize: number;
      zoom: number;
    }>;
    setManualViewState(
      state: Readonly<{
        mode: DocumentHistoryTypes.ManualMode;
        brushSize: number;
        zoom: number;
      }>,
    ): void;
    magicDraft(): MagicDraftEngine | null;
    magicViewState(): Readonly<{ mode: MagicCutoutTypes.Mode; radius: number }>;
    setMagicViewState(
      state: Readonly<{ mode: MagicCutoutTypes.Mode; radius: number }>,
    ): void;
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
    processingSelection(): ProcessingSelection | null;
    reset(): void;
    removeItem(itemId: WorkspaceItemId): void;
    retryItem(itemId: WorkspaceItemId): Promise<void>;
    selectDocument(documentId: DocumentId): void;
    retry(modelMode?: AutomaticModelMode): void;
    retryEnhancements(): void;
    selectBackgroundImage(file: File): Promise<void>;
    subscribe(listener: () => void): () => void;
    subscribeActive(listener: () => void): () => void;
    workspaceSnapshot(): WorkspaceSnapshot;
  };

  type Options = {
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

  type Dependencies = {
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
}
