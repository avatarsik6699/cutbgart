import { describe, expect, it } from "vitest";

import {
  buildDocumentSnapshot,
  buildDocumentState,
  buildProcessingError,
} from "@/v2/testing";

import { createRunId, decideDocumentCommand, transitionDocument } from "./index";

function seededSequence(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value;
  };
}

describe("document transition invariants", () => {
  it("preserves correlation, one-writer state, and terminal cleanup across seeded paths", () => {
    const random = seededSequence(33);
    const terminalCounts = { cancelled: 0, failed: 0, succeeded: 0 };

    for (let iteration = 0; iteration < 120; iteration += 1) {
      const initial = buildDocumentState();
      const runId = createRunId(`run-${String(iteration)}`);
      const started = decideDocumentCommand(initial, {
        command: {
          type: "START_AUTOMATIC_REMOVAL",
          documentId: initial.documentId,
          backend: "local",
        },
        runId,
      });
      expect(started.outcome.status).toBe("accepted");
      expect(started.state.activeRun).toEqual({ runId, expectedRevision: 0 });

      const branch = random() % 3;
      if (branch === 0) {
        terminalCounts.cancelled += 1;
        const cancelling = decideDocumentCommand(started.state, {
          command: { type: "CANCEL_ACTIVE_RUN", documentId: initial.documentId },
        });
        const terminal = transitionDocument(cancelling.state, {
          type: "PROCESSING_CANCELLED",
          documentId: initial.documentId,
          runId,
          expectedRevision: 0,
        });
        expect(terminal.state).toMatchObject({ status: "ready", activeRun: null });
        expect(terminal.effects).toHaveLength(1);
      } else if (branch === 1) {
        terminalCounts.failed += 1;
        const terminal = transitionDocument(started.state, {
          type: "PROCESSING_FAILED",
          documentId: initial.documentId,
          runId,
          expectedRevision: 0,
          error: buildProcessingError(),
        });
        expect(terminal.state).toMatchObject({ status: "error", activeRun: null });
        expect(terminal.effects).toHaveLength(1);
      } else {
        terminalCounts.succeeded += 1;
        const succeeded = transitionDocument(started.state, {
          type: "PROCESSING_SUCCEEDED",
          documentId: initial.documentId,
          runId,
          expectedRevision: 0,
          snapshot: buildDocumentSnapshot(),
        });
        const committed = transitionDocument(succeeded.state, {
          type: "COMMIT_ACCEPTED",
          documentId: initial.documentId,
          runId,
          expectedRevision: 0,
        });
        expect(committed.state).toMatchObject({
          status: "result",
          activeRun: null,
          pendingCommit: null,
          revision: 1,
        });
      }
    }

    expect(terminalCounts.cancelled).toBeGreaterThan(0);
    expect(terminalCounts.failed).toBeGreaterThan(0);
    expect(terminalCounts.succeeded).toBeGreaterThan(0);
  });
});
