import type { ArtifactId, DocumentId, ManualDraftId, Revision } from "./ids";

export type StartAutomaticRemovalCommand = {
  type: "START_AUTOMATIC_REMOVAL";
  documentId: DocumentId;
  backend: "local";
};

export type CancelActiveRunCommand = {
  type: "CANCEL_ACTIVE_RUN";
  documentId: DocumentId;
};

export type ExportPngCommand = {
  type: "EXPORT_PNG";
  documentId: DocumentId;
  expectedRevision: Revision;
};

export type ResetDocumentCommand = {
  type: "RESET_DOCUMENT";
  documentId: DocumentId;
};

export type BeginManualCutoutCommand = {
  type: "BEGIN_MANUAL_CUTOUT";
  documentId: DocumentId;
  expectedRevision: Revision;
};

export type ApplyManualCutoutCommand = {
  type: "APPLY_MANUAL_CUTOUT";
  documentId: DocumentId;
  draftId: ManualDraftId;
  expectedRevision: Revision;
  draftMatte: ArtifactId;
};

export type CancelManualCutoutCommand = {
  type: "CANCEL_MANUAL_CUTOUT";
  documentId: DocumentId;
  draftId: ManualDraftId;
};

export type UndoDocumentCommand = {
  type: "UNDO_DOCUMENT";
  documentId: DocumentId;
  expectedRevision: Revision;
};

export type RedoDocumentCommand = {
  type: "REDO_DOCUMENT";
  documentId: DocumentId;
  expectedRevision: Revision;
};

export type DocumentCommand =
  | StartAutomaticRemovalCommand
  | CancelActiveRunCommand
  | ExportPngCommand
  | ResetDocumentCommand
  | BeginManualCutoutCommand
  | ApplyManualCutoutCommand
  | CancelManualCutoutCommand
  | UndoDocumentCommand
  | RedoDocumentCommand;

export type EditorCommandType = "IMPORT_IMAGE" | DocumentCommand["type"];

export type CommandRejectionReason =
  | "document-exists"
  | "document-not-found"
  | "not-ready"
  | "run-active"
  | "no-active-run"
  | "no-result"
  | "stale-revision"
  | "draft-active"
  | "no-draft"
  | "draft-not-dirty"
  | "history-boundary"
  | "disposed";

export type CommandOutcome =
  | { status: "accepted"; command: EditorCommandType }
  | { status: "rejected"; command: EditorCommandType; reason: CommandRejectionReason };
