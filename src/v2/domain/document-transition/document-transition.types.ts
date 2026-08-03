import type { CommandOutcome, DocumentCommand } from "../commands";
import type { DocumentSnapshot, DocumentState } from "../document";
import type { ArtifactId, DocumentId, Revision, RunId } from "../ids";
import type { RunCorrelation } from "../processing";

export type DocumentCommandEnvelope =
  | {
      command: Extract<DocumentCommand, { type: "START_AUTOMATIC_REMOVAL" }>;
      runId: RunId;
    }
  | { command: Exclude<DocumentCommand, { type: "START_AUTOMATIC_REMOVAL" }> };

export type DocumentEffect =
  | (RunCorrelation & { type: "start-processing"; source: ArtifactId })
  | (RunCorrelation & { type: "cancel-processing" })
  | (RunCorrelation & { type: "promote-run"; snapshot: DocumentSnapshot })
  | { type: "release-run-if-owned"; documentId: DocumentId; runId: RunId }
  | { type: "release-document"; documentId: DocumentId }
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
