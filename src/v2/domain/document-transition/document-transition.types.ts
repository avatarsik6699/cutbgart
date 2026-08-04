import type { CommandOutcome, DocumentCommand } from "../commands";
import type { DocumentSnapshot, DocumentState } from "../document";
import type {
  ArtifactId,
  BackgroundDraftId,
  DocumentId,
  EditOperationId,
  EnhancementDraftId,
  ManualDraftId,
  MagicDraftId,
  Revision,
  RunId,
} from "../ids";
import type { DocumentHistoryEntry } from "../document-history";
import type { ProcessingRequest, RunCorrelation } from "../processing";

export type DocumentCommandEnvelope =
  | {
      command: Extract<DocumentCommand, { type: "START_AUTOMATIC_REMOVAL" }>;
      runId: RunId;
    }
  | {
      command: Extract<DocumentCommand, { type: "BEGIN_MANUAL_CUTOUT" }>;
      draftId: ManualDraftId;
    }
  | {
      command: Extract<DocumentCommand, { type: "BEGIN_MAGIC_CUTOUT" }>;
      draftId: MagicDraftId;
    }
  | {
      command: Extract<DocumentCommand, { type: "BEGIN_BACKGROUND" }>;
      draftId: BackgroundDraftId;
    }
  | {
      command: Extract<DocumentCommand, { type: "BEGIN_ENHANCEMENTS" }>;
      draftId: EnhancementDraftId;
    }
  | {
      command: Extract<DocumentCommand, { type: "APPLY_MANUAL_CUTOUT" }>;
      operationId: EditOperationId;
    }
  | {
      command: Extract<DocumentCommand, { type: "APPLY_MAGIC_CUTOUT" }>;
      operationId: EditOperationId;
    }
  | {
      command: Extract<DocumentCommand, { type: "APPLY_BACKGROUND" }>;
      operationId: EditOperationId;
    }
  | {
      command: Extract<DocumentCommand, { type: "APPLY_ENHANCEMENTS" }>;
      operationId: EditOperationId;
    }
  | {
      command: Exclude<
        DocumentCommand,
        {
          type:
            | "START_AUTOMATIC_REMOVAL"
            | "BEGIN_MANUAL_CUTOUT"
            | "APPLY_MANUAL_CUTOUT"
            | "BEGIN_MAGIC_CUTOUT"
            | "APPLY_MAGIC_CUTOUT"
            | "BEGIN_BACKGROUND"
            | "APPLY_BACKGROUND"
            | "BEGIN_ENHANCEMENTS"
            | "APPLY_ENHANCEMENTS";
        }
      >;
    };

export type DocumentEffect =
  | (ProcessingRequest & { type: "start-processing" })
  | (RunCorrelation & { type: "cancel-processing" })
  | (RunCorrelation & { type: "promote-run"; snapshot: DocumentSnapshot })
  | { type: "release-run-if-owned"; documentId: DocumentId; runId: RunId }
  | { type: "release-document"; documentId: DocumentId }
  | { type: "release-manual-draft"; documentId: DocumentId; draftId: ManualDraftId }
  | { type: "release-magic-draft"; documentId: DocumentId; draftId: MagicDraftId }
  | {
      type: "release-background-draft";
      documentId: DocumentId;
      draftId: BackgroundDraftId;
    }
  | {
      type: "release-enhancement-draft";
      documentId: DocumentId;
      draftId: EnhancementDraftId;
    }
  | {
      type: "cancel-magic-prediction";
      documentId: DocumentId;
      draftId: MagicDraftId;
      runId: RunId;
    }
  | {
      type: "commit-manual-history";
      documentId: DocumentId;
      draftId: ManualDraftId;
      entry: DocumentHistoryEntry;
      released: readonly DocumentHistoryEntry[];
    }
  | {
      type: "commit-magic-history";
      documentId: DocumentId;
      draftId: MagicDraftId;
      entry: DocumentHistoryEntry;
      released: readonly DocumentHistoryEntry[];
    }
  | {
      type: "commit-background-history";
      documentId: DocumentId;
      draftId: BackgroundDraftId;
      entry: DocumentHistoryEntry;
      released: readonly DocumentHistoryEntry[];
    }
  | {
      type: "commit-enhancement-history";
      documentId: DocumentId;
      draftId: EnhancementDraftId;
      entry: DocumentHistoryEntry;
      released: readonly DocumentHistoryEntry[];
    }
  | {
      type: "move-document-history";
      documentId: DocumentId;
      from: DocumentSnapshot;
      to: DocumentSnapshot;
    }
  | {
      type: "export-png";
      documentId: DocumentId;
      artifactId: ArtifactId;
      revision: Revision;
    };

export type DocumentDecision = {
  outcome: CommandOutcome;
  state: DocumentState;
  effects: readonly DocumentEffect[];
};

export type DocumentTransition =
  | { outcome: "applied"; state: DocumentState; effects: readonly DocumentEffect[] }
  | { outcome: "ignored-stale"; state: DocumentState; effects: readonly DocumentEffect[] }
  | {
      outcome: "rejected";
      state: DocumentState;
      effects: readonly [];
      reason: "illegal-transition";
    };
