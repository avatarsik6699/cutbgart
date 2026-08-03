import type { DocumentSnapshot } from "./artifacts";
import type {
  ArtifactId,
  BackgroundDraftId,
  DocumentId,
  EditOperationId,
  EnhancementDraftId,
  ImageId,
  MagicCandidateId,
  MagicDraftId,
  Revision,
  RunId,
} from "./ids";
import type { ProcessingError, ProcessingStage } from "./processing";
import type { DocumentHistory, ManualCutoutDraft } from "./document-history";
import type { MagicCutoutDraft } from "./magic-cutout";
import type { BackgroundDraft } from "./background";
import type { EnhancementDraft } from "./enhancements";
import type { MagicCandidateSummary } from "./magic-cutout";

export type { DocumentSnapshot } from "./artifacts";

export type ActiveToolDraft =
  ManualCutoutDraft | MagicCutoutDraft | BackgroundDraft | EnhancementDraft;

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

export type ActiveMagicPrediction = {
  documentId: DocumentId;
  draftId: MagicDraftId;
  runId: RunId;
  expectedRevision: Revision;
  draftRevision: Revision;
};

export type PendingMagicCommit = {
  draftId: MagicDraftId;
  candidateId: MagicCandidateId;
  expectedRevision: Revision;
  draftRevision: Revision;
  operationId: EditOperationId;
};

export type PendingBackgroundCommit = {
  draftId: BackgroundDraftId;
  expectedRevision: Revision;
  draftRevision: Revision;
  operationId: EditOperationId;
};

export type PendingEnhancementCommit = {
  draftId: EnhancementDraftId;
  runId: RunId;
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
  | "magic-predicting"
  | "magic-applying"
  | "background-applying"
  | "enhancement-queued"
  | "enhancement-running"
  | "enhancement-applying"
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
  activeMagicPrediction: ActiveMagicPrediction | null;
  pendingMagicCommit: PendingMagicCommit | null;
  pendingBackgroundCommit: PendingBackgroundCommit | null;
  pendingEnhancementCommit: PendingEnhancementCommit | null;
  magicCandidates: readonly MagicCandidateSummary[];
  activeDraft: ActiveToolDraft | null;
  history: DocumentHistory;
  status: DocumentStatus;
  stage: ProcessingStage | null;
  progress: number | null;
  error: ProcessingError | null;
};
