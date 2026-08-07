import { describe, expect, it } from "vitest";

import { createEmptyDocumentHistory } from "../document-history";
import type { DocumentState } from "../document";
import {
  createArtifactId,
  createDocumentId,
  createEditOperationId,
  createImageId,
  createMagicCandidateId,
  createMagicDraftId,
  createRunId,
} from "../ids";
import { decideDocumentCommand, transitionDocument } from "../document-transition";

const documentId = createDocumentId("document-1");
const draftId = createMagicDraftId("magic-draft-1");
const runId = createRunId("magic-run-1");
const candidateId = createMagicCandidateId("candidate-1");
const before = {
  automaticModelMode: "isnet-q8" as const,
  matte: createArtifactId("matte-before"),
  foreground: null,
  composite: createArtifactId("composite-before"),
  background: { type: "transparent" as const },
};

function resultState(): DocumentState {
  return {
    documentId,
    imageId: createImageId("image-1"),
    source: createArtifactId("source-1"),
    revision: 4,
    committed: before,
    baseline: before,
    activeRun: null,
    pendingCommit: null,
    pendingManualCommit: null,
    activeMagicPrediction: null,
    pendingMagicCommit: null,
    pendingBackgroundCommit: null,
    pendingEnhancementCommit: null,
    magicCandidates: [],
    activeDraft: null,
    history: createEmptyDocumentHistory(),
    status: "result",
    stage: null,
    progress: null,
    error: null,
    automaticReprocessError: null,
  };
}

function beginMagic(state = resultState()): DocumentState {
  return decideDocumentCommand(state, {
    command: { type: "BEGIN_MAGIC_CUTOUT", documentId, expectedRevision: 4 },
    draftId,
  }).state;
}

function dirtyMagic(state = beginMagic()): DocumentState {
  return decideDocumentCommand(state, {
    command: {
      type: "MAGIC_DRAFT_CHANGED",
      documentId,
      draftId,
      expectedRevision: 4,
      draftRevision: 1,
      dirty: true,
    },
  }).state;
}

describe("Magic document transitions", () => {
  it("keeps draft mutation and prediction separate from committed history", () => {
    const dirty = dirtyMagic();
    expect(dirty.activeDraft).toMatchObject({
      kind: "magic-cutout",
      draftRevision: 1,
      dirty: true,
      status: "dirty",
    });
    expect(dirty.revision).toBe(4);
    expect(dirty.history.past).toHaveLength(0);

    const predicting = decideDocumentCommand(dirty, {
      command: {
        type: "PREDICT_MAGIC_CUTOUT",
        documentId,
        draftId,
        runId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    }).state;
    expect(predicting.status).toBe("magic-predicting");
    expect(predicting.revision).toBe(4);

    const preview = transitionDocument(predicting, {
      type: "MAGIC_PREVIEW_READY",
      documentId,
      draftId,
      runId,
      expectedRevision: 4,
      draftRevision: 1,
      candidates: [{ candidateId, score: 0.9 }],
    }).state;
    expect(preview.activeDraft).toMatchObject({ status: "preview" });
    expect(preview.magicCandidates).toEqual([{ candidateId, score: 0.9 }]);
    expect(preview.history.past).toHaveLength(0);
  });

  it("rejects a stale prediction and commits one explicit Magic history entry", () => {
    const dirty = dirtyMagic();
    const predicting = decideDocumentCommand(dirty, {
      command: {
        type: "PREDICT_MAGIC_CUTOUT",
        documentId,
        draftId,
        runId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    }).state;
    const stale = transitionDocument(predicting, {
      type: "MAGIC_PREVIEW_READY",
      documentId,
      draftId,
      runId,
      expectedRevision: 4,
      draftRevision: 0,
      candidates: [{ candidateId, score: 1 }],
    });
    expect(stale.outcome).toBe("ignored-stale");

    const preview = transitionDocument(predicting, {
      type: "MAGIC_PREVIEW_READY",
      documentId,
      draftId,
      runId,
      expectedRevision: 4,
      draftRevision: 1,
      candidates: [{ candidateId, score: 0.9 }],
    }).state;
    const applying = decideDocumentCommand(preview, {
      command: {
        type: "APPLY_MAGIC_CUTOUT",
        documentId,
        draftId,
        candidateId,
        expectedRevision: 4,
        draftRevision: 1,
      },
      operationId: createEditOperationId("operation-1"),
    }).state;
    const after = {
      automaticModelMode: "isnet-q8" as const,
      matte: createArtifactId("matte-after"),
      foreground: null,
      composite: createArtifactId("composite-after"),
      background: before.background,
    };
    const committed = transitionDocument(applying, {
      type: "MAGIC_COMMIT_SUCCEEDED",
      documentId,
      draftId,
      expectedRevision: 4,
      draftRevision: 1,
      snapshot: after,
      estimatedHistoricalBytes: 12,
    });

    expect(committed.state).toMatchObject({
      committed: after,
      revision: 5,
      activeDraft: null,
      status: "result",
    });
    expect(committed.state.history.past).toHaveLength(1);
    expect(committed.state.history.past[0]?.kind).toBe("magic-cutout");
    expect(committed.effects).toHaveLength(1);
  });

  it("cancels without changing committed state, revision, or history", () => {
    const dirty = dirtyMagic();
    const cancelled = decideDocumentCommand(dirty, {
      command: { type: "CANCEL_MAGIC_CUTOUT", documentId, draftId },
    });

    expect(cancelled.state.committed).toBe(before);
    expect(cancelled.state.revision).toBe(4);
    expect(cancelled.state.history).toEqual(dirty.history);
    expect(cancelled.state.activeDraft).toBeNull();
    expect(cancelled.effects).toEqual([
      { type: "release-magic-draft", documentId, draftId },
    ]);
  });
});
