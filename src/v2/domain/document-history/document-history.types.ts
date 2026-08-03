import type { DocumentSnapshot } from "../artifacts";
import type { DocumentId, EditOperationId, ManualDraftId, Revision } from "../ids";

export type ManualCutoutMode = "restore" | "erase";

export type ManualCutoutDraft = {
  kind: "manual-cutout";
  draftId: ManualDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  dirty: boolean;
};

export type DocumentHistoryEntry = {
  operationId: EditOperationId;
  kind: "manual-cutout" | "magic-cutout";
  before: DocumentSnapshot;
  after: DocumentSnapshot;
  estimatedHistoricalBytes: number;
};

export type DocumentHistory = {
  past: readonly DocumentHistoryEntry[];
  future: readonly DocumentHistoryEntry[];
  retainedHistoricalBytes: number;
};

export type DocumentHistoryChange = {
  history: DocumentHistory;
  released: readonly DocumentHistoryEntry[];
};

export type DocumentHistoryMove = DocumentHistoryChange & {
  entry: DocumentHistoryEntry | null;
  snapshot: DocumentSnapshot | null;
};
