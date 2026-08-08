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
import type { DocumentHistoryTypes } from "./document-history";
import type { MagicCutoutTypes } from "./magic-cutout";
import type { BackgroundTypes } from "./background";
import type { EnhancementTypes } from "./enhancements";
import type { AutomaticModelMode } from "@/shared/lib";

export type { DocumentSnapshot } from "./artifacts";

export type ActiveToolDraft =
  | DocumentHistoryTypes.ManualDraft
  | MagicCutoutTypes.Draft
  | BackgroundTypes.Draft
  | EnhancementTypes.Draft;

export type ActiveRun = {
  runId: RunId;
  expectedRevision: Revision;
  modelMode: AutomaticModelMode;
  operationId: EditOperationId;
};

export type PendingCommit = ActiveRun & {
  operationId: EditOperationId;
  snapshot: DocumentSnapshot;
};

export type PendingManualCommit = {
  draftId: DocumentHistoryTypes.ManualDraft["draftId"];
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
  magicCandidates: readonly MagicCutoutTypes.CandidateSummary[];
  activeDraft: ActiveToolDraft | null;
  history: DocumentHistoryTypes.State;
  status: DocumentStatus;
  stage: ProcessingStage | null;
  progress: number | null;
  error: ProcessingError | null;
  automaticReprocessError: ProcessingError | null;
};
