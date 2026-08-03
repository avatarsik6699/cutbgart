import { describe, expect, it } from "vitest";

import {
  createBackgroundDraftId,
  createEditOperationId,
  createEnhancementDraftId,
  createRunId,
} from "./ids";
import { decideDocumentCommand, transitionDocument } from "./document-transition";
import { buildDocumentSnapshot, buildDocumentState } from "@/v2/testing";

describe("finishing-tool document transitions", () => {
  it("commits one Background operation and rejects a stale duplicate", () => {
    const before = buildDocumentSnapshot();
    const draftId = createBackgroundDraftId("background-draft-1");
    const operationId = createEditOperationId("background-operation-1");
    const initial = buildDocumentState({
      committed: before,
      baseline: before,
      revision: 2,
      status: "result",
    });
    const begun = decideDocumentCommand(initial, {
      command: {
        type: "BEGIN_BACKGROUND",
        documentId: initial.documentId,
        expectedRevision: 2,
      },
      draftId,
    }).state;
    const changed = decideDocumentCommand(begun, {
      command: {
        type: "CHANGE_BACKGROUND",
        documentId: initial.documentId,
        draftId,
        expectedRevision: 2,
        draftRevision: 1,
        fill: { type: "color", value: "#112233" },
      },
    }).state;
    const applyingDecision = decideDocumentCommand(changed, {
      command: {
        type: "APPLY_BACKGROUND",
        documentId: initial.documentId,
        draftId,
        expectedRevision: 2,
        draftRevision: 1,
      },
      operationId,
    });
    const applying = applyingDecision.state;
    const duplicateApply = decideDocumentCommand(applying, {
      command: {
        type: "APPLY_BACKGROUND",
        documentId: initial.documentId,
        draftId,
        expectedRevision: 2,
        draftRevision: 1,
      },
      operationId: createEditOperationId("background-operation-duplicate"),
    });
    expect(duplicateApply.outcome).toMatchObject({
      status: "rejected",
      reason: "operation-active",
    });
    expect(duplicateApply.state).toBe(applying);
    const inFlightChange = decideDocumentCommand(applying, {
      command: {
        type: "CHANGE_BACKGROUND",
        documentId: initial.documentId,
        draftId,
        expectedRevision: 2,
        draftRevision: 2,
        fill: { type: "transparent" },
      },
    });
    expect(inFlightChange.outcome).toMatchObject({
      status: "rejected",
      reason: "operation-active",
    });
    expect(inFlightChange.state).toBe(applying);
    const after = buildDocumentSnapshot({
      composite: before.composite,
      background: { type: "color", value: "#112233" },
    });
    const event = {
      type: "BACKGROUND_COMMIT_SUCCEEDED",
      documentId: initial.documentId,
      draftId,
      expectedRevision: 2,
      draftRevision: 1,
      snapshot: after,
      estimatedHistoricalBytes: 12,
    } as const;
    const committed = transitionDocument(applying, event);
    expect(committed.state).toMatchObject({
      committed: after,
      revision: 3,
      activeDraft: null,
      pendingBackgroundCommit: null,
      status: "result",
    });
    expect(committed.state.history.past).toHaveLength(1);
    expect(committed.state.history.past[0]).toMatchObject({
      operationId,
      kind: "background",
      before,
      after,
    });

    const stale = transitionDocument(committed.state, event);
    expect(stale.outcome).toBe("ignored-stale");
    expect(stale.state).toBe(committed.state);
    expect(stale.effects).toEqual([
      {
        type: "release-background-draft",
        documentId: initial.documentId,
        draftId,
      },
    ]);

    const undone = decideDocumentCommand(committed.state, {
      command: {
        type: "UNDO_DOCUMENT",
        documentId: initial.documentId,
        expectedRevision: 3,
      },
    });
    expect(undone.state).toMatchObject({
      committed: { background: { type: "transparent" } },
      revision: 4,
    });
    const redone = decideDocumentCommand(undone.state, {
      command: {
        type: "REDO_DOCUMENT",
        documentId: initial.documentId,
        expectedRevision: 4,
      },
    });
    expect(redone.state).toMatchObject({
      committed: { background: { type: "color", value: "#112233" } },
      revision: 5,
    });
  });

  it("permits only one finishing draft and admits another after explicit Cancel", () => {
    const before = buildDocumentSnapshot();
    const backgroundDraftId = createBackgroundDraftId("background-draft-1");
    const enhancementDraftId = createEnhancementDraftId("enhancement-draft-1");
    const initial = buildDocumentState({
      committed: before,
      baseline: before,
      revision: 1,
      status: "result",
    });
    const withBackground = decideDocumentCommand(initial, {
      command: {
        type: "BEGIN_BACKGROUND",
        documentId: initial.documentId,
        expectedRevision: 1,
      },
      draftId: backgroundDraftId,
    }).state;
    const blocked = decideDocumentCommand(withBackground, {
      command: {
        type: "BEGIN_ENHANCEMENTS",
        documentId: initial.documentId,
        expectedRevision: 1,
      },
      draftId: enhancementDraftId,
    });
    expect(blocked.outcome).toMatchObject({
      status: "rejected",
      reason: "draft-active",
    });

    const cancelled = decideDocumentCommand(withBackground, {
      command: {
        type: "CANCEL_BACKGROUND",
        documentId: initial.documentId,
        draftId: backgroundDraftId,
      },
    });
    expect(cancelled.state).toMatchObject({
      committed: before,
      revision: 1,
      activeDraft: null,
      status: "result",
    });
    const enhancement = decideDocumentCommand(cancelled.state, {
      command: {
        type: "BEGIN_ENHANCEMENTS",
        documentId: initial.documentId,
        expectedRevision: 1,
      },
      draftId: enhancementDraftId,
    });
    expect(enhancement.outcome).toMatchObject({ status: "accepted" });
    expect(enhancement.state.activeDraft?.kind).toBe("enhance");
  });

  it("keeps Enhancement no-op/failure atomic and commits one changed result", () => {
    const before = buildDocumentSnapshot();
    const draftId = createEnhancementDraftId("enhancement-draft-1");
    const operationId = createEditOperationId("enhancement-operation-1");
    const runId = createRunId("enhancement-run-1");
    const initial = buildDocumentState({
      committed: before,
      baseline: before,
      revision: 5,
      status: "result",
    });
    const begun = decideDocumentCommand(initial, {
      command: {
        type: "BEGIN_ENHANCEMENTS",
        documentId: initial.documentId,
        expectedRevision: 5,
      },
      draftId,
    }).state;
    const applyingDecision = decideDocumentCommand(begun, {
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId: initial.documentId,
        draftId,
        runId,
        expectedRevision: 5,
      },
      operationId,
    });
    const applying = applyingDecision.state;
    const duplicateApply = decideDocumentCommand(applying, {
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId: initial.documentId,
        draftId,
        runId: createRunId("enhancement-run-duplicate"),
        expectedRevision: 5,
      },
      operationId: createEditOperationId("enhancement-operation-duplicate"),
    });
    expect(duplicateApply.outcome).toMatchObject({
      status: "rejected",
      reason: "operation-active",
    });
    expect(duplicateApply.state).toBe(applying);
    const inFlightChange = decideDocumentCommand(applying, {
      command: {
        type: "CHANGE_ENHANCEMENTS",
        documentId: initial.documentId,
        draftId,
        expectedRevision: 5,
        operationIds: ["fine-detail"],
      },
    });
    expect(inFlightChange.outcome).toMatchObject({
      status: "rejected",
      reason: "operation-active",
    });
    expect(inFlightChange.state).toBe(applying);
    const started = transitionDocument(applying, {
      type: "ENHANCEMENT_STARTED",
      documentId: initial.documentId,
      draftId,
      runId,
      expectedRevision: 5,
      operationIds: ["fine-detail", "colour-halo"],
    });
    expect(started.state).toMatchObject({ status: "enhancement-running" });

    const unchanged = transitionDocument(started.state, {
      type: "ENHANCEMENT_UNCHANGED",
      documentId: initial.documentId,
      draftId,
      runId,
      expectedRevision: 5,
    });
    expect(unchanged.state).toMatchObject({
      committed: before,
      revision: 5,
      pendingEnhancementCommit: null,
      status: "result",
    });
    expect(unchanged.state.history.past).toEqual([]);

    const retry = decideDocumentCommand(unchanged.state, {
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId: initial.documentId,
        draftId,
        runId: createRunId("enhancement-run-2"),
        expectedRevision: 5,
      },
      operationId,
    }).state;
    const after = buildDocumentSnapshot({
      matte: before.matte,
      foreground: before.foreground,
      background: before.background,
    });
    const committed = transitionDocument(retry, {
      type: "ENHANCEMENT_COMMIT_SUCCEEDED",
      documentId: initial.documentId,
      draftId,
      runId: createRunId("enhancement-run-2"),
      expectedRevision: 5,
      snapshot: after,
      estimatedHistoricalBytes: 10,
    });
    expect(committed.state).toMatchObject({
      committed: after,
      revision: 6,
      activeDraft: null,
      status: "result",
    });
    expect(committed.state.history.past[0]?.kind).toBe("enhance");
  });

  it("rejects empty Enhancement selection and preserves committed state on failure", () => {
    const before = buildDocumentSnapshot();
    const draftId = createEnhancementDraftId("enhancement-draft-1");
    const initial = buildDocumentState({
      committed: before,
      revision: 1,
      status: "result",
    });
    const begun = decideDocumentCommand(initial, {
      command: {
        type: "BEGIN_ENHANCEMENTS",
        documentId: initial.documentId,
        expectedRevision: 1,
      },
      draftId,
    }).state;
    const empty = decideDocumentCommand(begun, {
      command: {
        type: "CHANGE_ENHANCEMENTS",
        documentId: initial.documentId,
        draftId,
        expectedRevision: 1,
        operationIds: [],
      },
    }).state;
    const rejected = decideDocumentCommand(empty, {
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId: initial.documentId,
        draftId,
        runId: createRunId("run-empty"),
        expectedRevision: 1,
      },
      operationId: createEditOperationId("operation-empty"),
    });
    expect(rejected.outcome).toMatchObject({
      status: "rejected",
      reason: "no-operations",
    });
    expect(rejected.state).toBe(empty);
  });
});
