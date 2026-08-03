import type { DocumentSnapshot } from "./artifacts";
import type { ArtifactId, DocumentId, ImageId, Revision, RunId } from "./ids";
import type { ProcessingError, ProcessingStage } from "./processing";
import type { DocumentHistory, ManualCutoutDraft } from "./document-history";
import type { EditOperationId } from "./ids";

export type { DocumentSnapshot } from "./artifacts";

export type ActiveRun = {
  runId: RunId;
  expectedRevision: Revision;
};

export type PendingCommit = ActiveRun & {
  snapshot: DocumentSnapshot;
};

export type PendingManualCommit = {
  draftId: ManualCutoutDraft["draftId"];
  draftMatte: ArtifactId;
  expectedRevision: Revision;
  operationId: EditOperationId;
};

export type DocumentStatus =
  | "preparing"
  | "ready"
  | "queued"
  | "model-loading"
  | "processing"
  | "cancelling"
  | "committing"
  | "manual-applying"
  | "result"
  | "error"
  | "disposed";

export type DocumentState = {
  documentId: DocumentId;
  imageId: ImageId;
  source: ArtifactId;
  revision: Revision;
  committed: DocumentSnapshot | null;
  baseline: DocumentSnapshot | null;
  activeRun: ActiveRun | null;
  pendingCommit: PendingCommit | null;
  pendingManualCommit: PendingManualCommit | null;
  manualDraft: ManualCutoutDraft | null;
  history: DocumentHistory;
  status: DocumentStatus;
  stage: ProcessingStage | null;
  progress: number | null;
  error: ProcessingError | null;
};
