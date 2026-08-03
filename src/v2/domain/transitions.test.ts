import { describe, expect, it } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createImageId,
  createRunId,
  decideDocumentCommand,
  transitionDocument,
  type DocumentSnapshot,
  type DocumentState,
  type ProcessingError,
  type RunCorrelation,
} from "./index";

const documentId = createDocumentId("document-1");
const runId = createRunId("run-1");
const correlation: RunCorrelation = { documentId, runId, expectedRevision: 0 };
const snapshot: DocumentSnapshot = {
  matte: createArtifactId("matte-1"),
  foreground: null,
  composite: createArtifactId("composite-1"),
  background: { type: "transparent" },
};
const retryableError: ProcessingError = {
  code: "worker-crashed",
  message: "Worker crashed",
  retryable: true,
};

function createReadyState(overrides: Partial<DocumentState> = {}): DocumentState {
  return {
    documentId,
    imageId: createImageId("image-1"),
    source: createArtifactId("source-1"),
    revision: 0,
    committed: null,
    baseline: null,
    activeRun: null,
    pendingCommit: null,
    pendingManualCommit: null,
    activeMagicPrediction: null,
    pendingMagicCommit: null,
    pendingBackgroundCommit: null,
    pendingEnhancementCommit: null,
    magicCandidates: [],
    activeDraft: null,
    history: { past: [], future: [], retainedHistoricalBytes: 0 },
    status: "ready",
    stage: null,
    progress: null,
    error: null,
    ...overrides,
  };
}

describe("document command decisions", () => {
  it("starts one correlated run and rejects a duplicate", () => {
    const started = decideDocumentCommand(createReadyState(), {
      command: { type: "START_AUTOMATIC_REMOVAL", documentId, backend: "local" },
      runId,
    });

    expect(started.outcome.status).toBe("accepted");
    expect(started.state.activeRun).toEqual({ runId, expectedRevision: 0 });
    expect(started.effects).toEqual([
      {
        type: "start-processing",
        source: createArtifactId("source-1"),
        ...correlation,
      },
    ]);

    const duplicate = decideDocumentCommand(started.state, {
      command: { type: "START_AUTOMATIC_REMOVAL", documentId, backend: "local" },
      runId: createRunId("run-2"),
    });
    expect(duplicate.outcome).toEqual({
      status: "rejected",
      command: "START_AUTOMATIC_REMOVAL",
      reason: "run-active",
    });
    expect(duplicate.state).toBe(started.state);
  });

  it("turns cancel into one effect and rejects a repeated cancel", () => {
    const running = createReadyState({
      activeRun: { runId, expectedRevision: 0 },
      status: "processing",
      stage: "automatic-remove",
    });
    const cancelled = decideDocumentCommand(running, {
      command: { type: "CANCEL_ACTIVE_RUN", documentId },
    });

    expect(cancelled.state.status).toBe("cancelling");
    expect(cancelled.effects).toEqual([{ type: "cancel-processing", ...correlation }]);
    expect(
      decideDocumentCommand(cancelled.state, {
        command: { type: "CANCEL_ACTIVE_RUN", documentId },
      }).outcome,
    ).toEqual({
      status: "rejected",
      command: "CANCEL_ACTIVE_RUN",
      reason: "no-active-run",
    });
  });

  it("exports only the current committed composite without a processing effect", () => {
    const result = createReadyState({
      committed: snapshot,
      revision: 2,
      status: "result",
    });
    const exported = decideDocumentCommand(result, {
      command: { type: "EXPORT_PNG", documentId, expectedRevision: 2 },
    });

    expect(exported.effects).toEqual([
      {
        type: "export-png",
        documentId,
        artifactId: snapshot.composite,
        revision: 2,
      },
    ]);
    expect(
      decideDocumentCommand(result, {
        command: { type: "EXPORT_PNG", documentId, expectedRevision: 1 },
      }).outcome,
    ).toMatchObject({ status: "rejected", reason: "stale-revision" });
  });

  it("orders cancellation and deterministic cleanup on reset", () => {
    const running = createReadyState({
      activeRun: { runId, expectedRevision: 0 },
      status: "processing",
    });
    const reset = decideDocumentCommand(running, {
      command: { type: "RESET_DOCUMENT", documentId },
    });

    expect(reset.state.status).toBe("disposed");
    expect(reset.effects.map((effect) => effect.type)).toEqual([
      "cancel-processing",
      "release-run-if-owned",
      "release-document",
    ]);
  });
});

describe("document event transitions", () => {
  it("commits exactly one matching success and increments the revision", () => {
    const running = createReadyState({
      activeRun: { runId, expectedRevision: 0 },
      status: "processing",
    });
    const succeeded = transitionDocument(running, {
      type: "PROCESSING_SUCCEEDED",
      snapshot,
      ...correlation,
    });

    expect(succeeded.outcome).toBe("applied");
    expect(succeeded.state.status).toBe("committing");
    expect(succeeded.effects).toEqual([
      { type: "promote-run", snapshot, ...correlation },
    ]);

    const committed = transitionDocument(succeeded.state, {
      type: "COMMIT_ACCEPTED",
      ...correlation,
    });
    expect(committed.state).toMatchObject({
      status: "result",
      revision: 1,
      committed: snapshot,
      activeRun: null,
      pendingCommit: null,
    });
    expect(committed.effects).toEqual([]);

    const duplicate = transitionDocument(committed.state, {
      type: "COMMIT_ACCEPTED",
      ...correlation,
    });
    expect(duplicate.outcome).toBe("ignored-stale");
    expect(duplicate.state).toBe(committed.state);
  });

  it("rejects a stale success and requests safe run cleanup", () => {
    const running = createReadyState({
      activeRun: { runId, expectedRevision: 0 },
      revision: 1,
      status: "processing",
    });
    const stale = transitionDocument(running, {
      type: "PROCESSING_SUCCEEDED",
      snapshot,
      ...correlation,
    });

    expect(stale.outcome).toBe("ignored-stale");
    expect(stale.state).toBe(running);
    expect(stale.effects).toEqual([{ type: "release-run-if-owned", documentId, runId }]);
  });

  it("never lets a late success escape cancelling", () => {
    const cancelling = createReadyState({
      activeRun: { runId, expectedRevision: 0 },
      status: "cancelling",
    });
    const stale = transitionDocument(cancelling, {
      type: "PROCESSING_SUCCEEDED",
      snapshot,
      ...correlation,
    });
    expect(stale.outcome).toBe("ignored-stale");
    expect(stale.state.status).toBe("cancelling");

    const terminal = transitionDocument(cancelling, {
      type: "PROCESSING_CANCELLED",
      ...correlation,
    });
    expect(terminal.state).toMatchObject({ status: "ready", activeRun: null });
    expect(terminal.effects).toEqual([
      { type: "release-run-if-owned", documentId, runId },
    ]);
  });

  it("enters a retryable error only for the matching active run", () => {
    const running = createReadyState({
      activeRun: { runId, expectedRevision: 0 },
      status: "processing",
    });
    const failed = transitionDocument(running, {
      type: "PROCESSING_FAILED",
      error: retryableError,
      ...correlation,
    });
    expect(failed.state).toMatchObject({
      status: "error",
      error: retryableError,
      activeRun: null,
    });

    const retry = decideDocumentCommand(failed.state, {
      command: { type: "START_AUTOMATIC_REMOVAL", documentId, backend: "local" },
      runId: createRunId("run-2"),
    });
    expect(retry.outcome.status).toBe("accepted");
  });
});
