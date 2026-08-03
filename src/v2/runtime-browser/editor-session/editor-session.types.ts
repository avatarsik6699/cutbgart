import type { DocumentActorRef, ProcessingGateway } from "@/v2/application";
import type { ArtifactRepositoryStats } from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";
import type { ManualDraftEngine, ManualDraftRepository } from "../manual-cutout";
import type { ManualCutoutCommitter } from "@/v2/application";
import type { DownloadAdapter, EditorIdSource } from "../platform";

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
  previewUrl: string | null;
  resultUrl: string | null;
  width: number;
};

export type EditorSessionSnapshot =
  | EmptyEditorSessionSnapshot
  | PreparingEditorSessionSnapshot
  | ActiveEditorSessionSnapshot;

export type EditorSession = {
  beginManual(): void;
  applyManual(): void;
  cancelManual(): void;
  cancel(): void;
  dispose(): Promise<void>;
  exportPng(): void;
  getSnapshot(): EditorSessionSnapshot;
  importImage(file: File): Promise<void>;
  manualDraft(): ManualDraftEngine | null;
  notifyManualDirty(): void;
  undoManual(): void;
  redoManual(): void;
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
};

export type EditorSessionDependencies = {
  download: DownloadAdapter;
  gateway: ProcessingGateway;
  ids: EditorIdSource;
  repository: ArtifactRepository;
  manualCommitter: ManualCutoutCommitter;
  manualDrafts: ManualDraftRepository;
};
