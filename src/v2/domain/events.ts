import type { ArtifactId, DocumentId, ManualDraftId, Revision, RunId } from "./ids";
import type { DocumentSnapshot } from "./artifacts";
import type {
  ProcessingError,
  ProcessingProgress,
  ProcessingTerminalEvent,
  RunCorrelation,
} from "./processing";

export type SourceRegisteredEvent = {
  type: "SOURCE_REGISTERED";
  documentId: DocumentId;
  source: ArtifactId;
};

export type PreparationEvent =
  | { type: "PREPARATION_STARTED"; documentId: DocumentId }
  | { type: "PREPARATION_SUCCEEDED"; documentId: DocumentId }
  | { type: "PREPARATION_FAILED"; documentId: DocumentId; error: ProcessingError };

export type ProcessingLifecycleEvent =
  | (RunCorrelation & { type: "PROCESSING_QUEUED" })
  | (RunCorrelation & { type: "PROCESSING_STARTED" })
  | (ProcessingProgress & { type: "PROCESSING_PROGRESS" })
  | (RunCorrelation & { type: "PROCESSING_CANCEL_REQUESTED" })
  | ProcessingTerminalEvent;

export type CommitEvent =
  | (RunCorrelation & { type: "COMMIT_ACCEPTED" })
  | (RunCorrelation & { type: "COMMIT_REJECTED_STALE" });

export type ExportEvent =
  | { type: "EXPORT_REQUESTED"; documentId: DocumentId; expectedRevision: Revision }
  | { type: "EXPORT_SUCCEEDED"; documentId: DocumentId; artifactId: ArtifactId }
  | { type: "EXPORT_FAILED"; documentId: DocumentId; error: ProcessingError };

export type DocumentLifecycleEvent =
  | { type: "DOCUMENT_RESET"; documentId: DocumentId }
  | { type: "DOCUMENT_DISPOSED"; documentId: DocumentId; runId: RunId | null };

export type ManualCutoutEvent =
  | {
      type: "MANUAL_DRAFT_DIRTY_CHANGED";
      documentId: DocumentId;
      draftId: ManualDraftId;
      dirty: boolean;
    }
  | {
      type: "MANUAL_COMMIT_SUCCEEDED";
      documentId: DocumentId;
      draftId: ManualDraftId;
      expectedRevision: Revision;
      snapshot: DocumentSnapshot;
      estimatedHistoricalBytes: number;
    }
  | {
      type: "MANUAL_COMMIT_FAILED";
      documentId: DocumentId;
      draftId: ManualDraftId;
      expectedRevision: Revision;
      error: ProcessingError;
    };

export type DocumentEvent =
  | SourceRegisteredEvent
  | PreparationEvent
  | ProcessingLifecycleEvent
  | CommitEvent
  | ExportEvent
  | ManualCutoutEvent
  | DocumentLifecycleEvent;
