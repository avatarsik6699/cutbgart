import type {
  ArtifactId,
  BackgroundDraftId,
  DocumentId,
  EnhancementDraftId,
  MagicCandidateId,
  MagicDraftId,
  ManualDraftId,
  Revision,
  RunId,
} from "./ids";
import type { BackgroundTypes } from "./background";
import type { EnhancementTypes } from "./enhancements";
import type { AutomaticModelMode } from "@/shared/lib";

export type StartAutomaticRemovalCommand = {
  type: "START_AUTOMATIC_REMOVAL";
  documentId: DocumentId;
  backend: "local";
  modelMode: AutomaticModelMode;
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

export type BeginMagicCutoutCommand = {
  type: "BEGIN_MAGIC_CUTOUT";
  documentId: DocumentId;
  expectedRevision: Revision;
};

export type MagicDraftChangedCommand = {
  type: "MAGIC_DRAFT_CHANGED";
  documentId: DocumentId;
  draftId: MagicDraftId;
  expectedRevision: Revision;
  draftRevision: Revision;
  dirty: boolean;
};

export type PredictMagicCutoutCommand = {
  type: "PREDICT_MAGIC_CUTOUT";
  documentId: DocumentId;
  draftId: MagicDraftId;
  runId: RunId;
  expectedRevision: Revision;
  draftRevision: Revision;
};

export type SelectMagicCandidateCommand = {
  type: "SELECT_MAGIC_CANDIDATE";
  documentId: DocumentId;
  draftId: MagicDraftId;
  candidateId: MagicCandidateId;
  expectedRevision: Revision;
  draftRevision: Revision;
};

export type ApplyMagicCutoutCommand = {
  type: "APPLY_MAGIC_CUTOUT";
  documentId: DocumentId;
  draftId: MagicDraftId;
  candidateId: MagicCandidateId;
  expectedRevision: Revision;
  draftRevision: Revision;
};

export type CancelMagicCutoutCommand = {
  type: "CANCEL_MAGIC_CUTOUT";
  documentId: DocumentId;
  draftId: MagicDraftId;
};

export type BeginBackgroundCommand = {
  type: "BEGIN_BACKGROUND";
  documentId: DocumentId;
  expectedRevision: Revision;
};

export type ChangeBackgroundCommand = {
  type: "CHANGE_BACKGROUND";
  documentId: DocumentId;
  draftId: BackgroundDraftId;
  expectedRevision: Revision;
  draftRevision: Revision;
  fill: BackgroundTypes.FillDescriptor;
};

export type ApplyBackgroundCommand = {
  type: "APPLY_BACKGROUND";
  documentId: DocumentId;
  draftId: BackgroundDraftId;
  expectedRevision: Revision;
  draftRevision: Revision;
};

export type CancelBackgroundCommand = {
  type: "CANCEL_BACKGROUND";
  documentId: DocumentId;
  draftId: BackgroundDraftId;
};

export type BeginEnhancementsCommand = {
  type: "BEGIN_ENHANCEMENTS";
  documentId: DocumentId;
  expectedRevision: Revision;
};

export type ChangeEnhancementsCommand = {
  type: "CHANGE_ENHANCEMENTS";
  documentId: DocumentId;
  draftId: EnhancementDraftId;
  expectedRevision: Revision;
  operationIds: readonly EnhancementTypes.OperationId[];
};

export type ApplyEnhancementsCommand = {
  type: "APPLY_ENHANCEMENTS";
  documentId: DocumentId;
  draftId: EnhancementDraftId;
  runId: RunId;
  expectedRevision: Revision;
};

export type CancelEnhancementsCommand = {
  type: "CANCEL_ENHANCEMENTS";
  documentId: DocumentId;
  draftId: EnhancementDraftId;
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
  | BeginMagicCutoutCommand
  | MagicDraftChangedCommand
  | PredictMagicCutoutCommand
  | SelectMagicCandidateCommand
  | ApplyMagicCutoutCommand
  | CancelMagicCutoutCommand
  | BeginBackgroundCommand
  | ChangeBackgroundCommand
  | ApplyBackgroundCommand
  | CancelBackgroundCommand
  | BeginEnhancementsCommand
  | ChangeEnhancementsCommand
  | ApplyEnhancementsCommand
  | CancelEnhancementsCommand
  | UndoDocumentCommand
  | RedoDocumentCommand;

export type EditorCommandType = "IMPORT_IMAGE" | DocumentCommand["type"];

export type CommandRejectionReason =
  | "document-exists"
  | "document-not-found"
  | "not-ready"
  | "run-active"
  | "same-model"
  | "no-active-run"
  | "no-result"
  | "stale-revision"
  | "draft-active"
  | "no-draft"
  | "draft-not-dirty"
  | "draft-revision-stale"
  | "operation-active"
  | "prediction-active"
  | "no-candidate"
  | "no-operations"
  | "invalid-background"
  | "history-boundary"
  | "disposed";

export type CommandOutcome =
  | { status: "accepted"; command: EditorCommandType }
  | { status: "rejected"; command: EditorCommandType; reason: CommandRejectionReason };

export type WorkspaceCommand =
  | { type: "REGISTER_DOCUMENT"; document: import("./document").DocumentState }
  | { type: "SELECT_DOCUMENT"; documentId: DocumentId }
  | { type: "REMOVE_DOCUMENT"; documentId: DocumentId }
  | { type: "DOCUMENT_COMMAND"; documentId: DocumentId; command: DocumentCommand }
  | { type: "DISPOSE" };

export type WorkspaceCommandOutcome =
  | {
      status: "accepted";
      command: WorkspaceCommand["type"];
      documentId?: DocumentId;
    }
  | {
      status: "rejected";
      command: WorkspaceCommand["type"];
      documentId?: DocumentId;
      reason: "duplicate-document" | "document-not-found" | "workspace-disposed";
    };
