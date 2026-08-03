import type { CommandOutcome, DocumentCommand } from "../commands";
import type { DocumentSnapshot, DocumentState } from "../document";
import type {
  ArtifactId,
  DocumentId,
  EditOperationId,
  ManualDraftId,
  Revision,
  RunId,
} from "../ids";
import type { DocumentHistoryEntry } from "../document-history";
import type { RunCorrelation } from "../processing";

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
      command: Extract<DocumentCommand, { type: "APPLY_MANUAL_CUTOUT" }>;
      operationId: EditOperationId;
    }
  | {
      command: Exclude<
        DocumentCommand,
        {
          type: "START_AUTOMATIC_REMOVAL" | "BEGIN_MANUAL_CUTOUT" | "APPLY_MANUAL_CUTOUT";
        }
      >;
    };

export type DocumentEffect =
  | (RunCorrelation & { type: "start-processing"; source: ArtifactId })
  | (RunCorrelation & { type: "cancel-processing" })
  | (RunCorrelation & { type: "promote-run"; snapshot: DocumentSnapshot })
  | { type: "release-run-if-owned"; documentId: DocumentId; runId: RunId }
  | { type: "release-document"; documentId: DocumentId }
  | { type: "release-manual-draft"; documentId: DocumentId; draftId: ManualDraftId }
  | {
      type: "commit-manual-history";
      documentId: DocumentId;
      draftId: ManualDraftId;
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
