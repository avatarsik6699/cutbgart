import { describe, expect, it } from "vitest";

import { createDocumentId, createMagicDraftId, createRunId } from "../ids";
import {
  advanceMagicDraftRevision,
  createMagicCutoutDraft,
  matchesMagicPrediction,
} from "./magic-cutout.policy";

describe("Magic Cutout domain policy", () => {
  const documentId = createDocumentId("document-1");
  const draftId = createMagicDraftId("magic-draft-1");

  it("creates clean ID-only draft metadata at the committed baseline", () => {
    expect(createMagicCutoutDraft({ documentId, draftId, baselineRevision: 3 })).toEqual({
      kind: "magic-cutout",
      documentId,
      draftId,
      baselineRevision: 3,
      draftRevision: 0,
      dirty: false,
      status: "ready",
      selectedCandidateId: null,
    });
  });

  it("invalidates a selected preview whenever the draft advances", () => {
    const draft = createMagicCutoutDraft({ documentId, draftId, baselineRevision: 3 });
    expect(advanceMagicDraftRevision({ ...draft, status: "preview" })).toMatchObject({
      draftRevision: 1,
      dirty: true,
      status: "dirty",
      selectedCandidateId: null,
    });
    expect(
      advanceMagicDraftRevision({ ...draft, draftRevision: Number.MAX_SAFE_INTEGER }),
    ).toBeNull();
  });

  it("matches both committed baseline and mutable draft revision", () => {
    const draft = {
      ...createMagicCutoutDraft({ documentId, draftId, baselineRevision: 3 }),
      draftRevision: 2,
    };
    const correlation = {
      documentId,
      draftId,
      runId: createRunId("magic-run-1"),
      expectedRevision: 3,
      draftRevision: 2,
    };

    expect(matchesMagicPrediction(draft, 3, correlation)).toBe(true);
    expect(matchesMagicPrediction(draft, 4, correlation)).toBe(false);
    expect(matchesMagicPrediction(draft, 3, { ...correlation, draftRevision: 1 })).toBe(
      false,
    );
  });
});
