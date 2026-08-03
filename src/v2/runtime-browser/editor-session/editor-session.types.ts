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
} from "@/v2/domain";

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
  "unsupported-file" | "invalid-image" | "preparation-failed";

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
  changeBackground(fill: BackgroundFillDescriptor): void;
  changeEnhancements(operationIds: readonly EnhancementOperationId[]): void;
  dispose(): Promise<void>;
  exportPng(): void;
  getSnapshot(): EditorSessionSnapshot;
  importImage(file: File): Promise<void>;
  manualDraft(): ManualDraftEngine | null;
  magicDraft(): MagicDraftEngine | null;
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
  reset(): void;
  retry(): void;
  retryEnhancements(): void;
  selectBackgroundImage(file: File): Promise<void>;
  subscribe(listener: () => void): () => void;
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
