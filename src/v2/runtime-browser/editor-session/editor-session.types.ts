import type {
  DocumentActorRef,
  MagicCutoutCommitter,
  MagicCutoutPredictor,
  ProcessingGateway,
} from "@/v2/application";
import type { ArtifactRepositoryStats, MagicCandidateId } from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";
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
  height: number;
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
  beginMagic(): void;
  beginManual(): void;
  applyMagic(): void;
  applyManual(): void;
  cancelMagic(): void;
  cancelManual(): void;
  cancel(): void;
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
  subscribe(listener: () => void): () => void;
};

export type EditorSessionOptions = {
  download?: DownloadAdapter;
  gateway?: ProcessingGateway;
  ids?: EditorIdSource;
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
  download: DownloadAdapter;
  gateway: ProcessingGateway;
  ids: EditorIdSource;
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
