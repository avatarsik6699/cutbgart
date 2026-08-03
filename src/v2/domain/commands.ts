import type { DocumentId, Revision } from "./ids";

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

export type DocumentCommand =
  | StartAutomaticRemovalCommand
  | CancelActiveRunCommand
  | ExportPngCommand
  | ResetDocumentCommand;

export type EditorCommandType = "IMPORT_IMAGE" | DocumentCommand["type"];

export type CommandRejectionReason =
  | "document-exists"
  | "document-not-found"
  | "not-ready"
  | "run-active"
  | "no-active-run"
  | "no-result"
  | "stale-revision"
  | "disposed";

export type CommandOutcome =
  | { status: "accepted"; command: EditorCommandType }
  | { status: "rejected"; command: EditorCommandType; reason: CommandRejectionReason };
