import type { DocumentSnapshot } from "./artifacts";
import type { ArtifactId, DocumentId, ImageId, Revision, RunId } from "./ids";
import type { ProcessingError, ProcessingStage } from "./processing";

export type { DocumentSnapshot } from "./artifacts";

export type ActiveRun = {
  runId: RunId;
  expectedRevision: Revision;
};

export type PendingCommit = ActiveRun & {
  snapshot: DocumentSnapshot;
};

export type DocumentStatus =
  | "preparing"
  | "ready"
  | "queued"
  | "model-loading"
  | "processing"
  | "cancelling"
  | "committing"
  | "result"
  | "error"
  | "disposed";

export type DocumentState = {
  documentId: DocumentId;
  imageId: ImageId;
  source: ArtifactId;
  revision: Revision;
  committed: DocumentSnapshot | null;
  activeRun: ActiveRun | null;
  pendingCommit: PendingCommit | null;
  status: DocumentStatus;
  stage: ProcessingStage | null;
  progress: number | null;
  error: ProcessingError | null;
};
