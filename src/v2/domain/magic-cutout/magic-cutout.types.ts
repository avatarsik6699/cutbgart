import type { DocumentId, MagicCandidateId, MagicDraftId, Revision, RunId } from "../ids";

export type MagicCutoutMode = "keep" | "remove";

export type MagicCutoutStatus =
  "ready" | "dirty" | "encoding" | "predicting" | "preview" | "error";

export type MagicCutoutDraft = {
  kind: "magic-cutout";
  draftId: MagicDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  draftRevision: Revision;
  dirty: boolean;
  status: MagicCutoutStatus;
  selectedCandidateId: MagicCandidateId | null;
};

export type MagicCandidateSummary = {
  candidateId: MagicCandidateId;
  score: number;
};

export type MagicPredictionCorrelation = {
  documentId: DocumentId;
  draftId: MagicDraftId;
  runId: RunId;
  expectedRevision: Revision;
  draftRevision: Revision;
};
