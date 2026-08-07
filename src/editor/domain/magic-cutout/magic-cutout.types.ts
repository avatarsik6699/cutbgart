import type { DocumentId, MagicCandidateId, MagicDraftId, Revision, RunId } from "../ids";

export declare namespace MagicCutoutTypes {
  type Mode = "keep" | "remove";

  type Status = "ready" | "dirty" | "encoding" | "predicting" | "preview" | "error";

  type Draft = {
    kind: "magic-cutout";
    draftId: MagicDraftId;
    documentId: DocumentId;
    baselineRevision: Revision;
    draftRevision: Revision;
    dirty: boolean;
    status: Status;
    selectedCandidateId: MagicCandidateId | null;
  };

  type CandidateSummary = {
    candidateId: MagicCandidateId;
    score: number;
  };

  type PredictionCorrelation = {
    documentId: DocumentId;
    draftId: MagicDraftId;
    runId: RunId;
    expectedRevision: Revision;
    draftRevision: Revision;
  };
}
