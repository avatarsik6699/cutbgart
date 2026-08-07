import type { DocumentId, MagicDraftId, Revision } from "../ids";
import type { MagicCutoutTypes } from "./magic-cutout.types";

export function createMagicCutoutDraft(input: {
  documentId: DocumentId;
  draftId: MagicDraftId;
  baselineRevision: Revision;
}): MagicCutoutTypes.Draft {
  return {
    kind: "magic-cutout",
    draftId: input.draftId,
    documentId: input.documentId,
    baselineRevision: input.baselineRevision,
    draftRevision: 0,
    dirty: false,
    status: "ready",
    selectedCandidateId: null,
  };
}

export function advanceMagicDraftRevision(
  draft: MagicCutoutTypes.Draft,
): MagicCutoutTypes.Draft | null {
  if (draft.draftRevision === Number.MAX_SAFE_INTEGER) return null;
  return {
    ...draft,
    draftRevision: draft.draftRevision + 1,
    dirty: true,
    status: "dirty",
    selectedCandidateId: null,
  };
}

export function matchesMagicPrediction(
  draft: MagicCutoutTypes.Draft,
  documentRevision: Revision,
  correlation: MagicCutoutTypes.PredictionCorrelation,
): boolean {
  return (
    draft.documentId === correlation.documentId &&
    draft.draftId === correlation.draftId &&
    draft.baselineRevision === documentRevision &&
    correlation.expectedRevision === documentRevision &&
    draft.draftRevision === correlation.draftRevision
  );
}
