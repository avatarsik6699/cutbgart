import { describe, expect, it } from "vitest";

import { createArtifactId, createEditOperationId } from "../index";
import {
  commitDocumentHistory,
  createEmptyDocumentHistory,
  DOCUMENT_HISTORY_BYTE_LIMIT,
  DOCUMENT_HISTORY_ENTRY_LIMIT,
  redoDocumentHistory,
  undoDocumentHistory,
} from "./index";
import type { DocumentHistoryEntry } from "./document-history.types";

function entry(index: number, bytes = 1): DocumentHistoryEntry {
  return {
    operationId: createEditOperationId(`operation-${index}`),
    kind: "manual-cutout",
    before: {
      matte: createArtifactId(`matte-before-${index}`),
      foreground: null,
      composite: createArtifactId(`composite-before-${index}`),
      background: { type: "transparent" },
    },
    after: {
      matte: createArtifactId(`matte-after-${index}`),
      foreground: null,
      composite: createArtifactId(`composite-after-${index}`),
      background: { type: "transparent" },
    },
    estimatedHistoricalBytes: bytes,
  };
}

describe("document history policy", () => {
  it("commits atomically, moves across undo/redo, and invalidates a redo branch", () => {
    const first = commitDocumentHistory(createEmptyDocumentHistory(), entry(1));
    const second = commitDocumentHistory(first.history, entry(2));
    const undone = undoDocumentHistory(second.history);
    expect(undone.snapshot).toEqual(entry(2).before);
    const redone = redoDocumentHistory(undone.history);
    expect(redone.snapshot).toEqual(entry(2).after);

    const branched = commitDocumentHistory(undone.history, entry(3));
    expect(branched.history.future).toEqual([]);
    expect(branched.released.map((item) => item.operationId)).toContain(
      createEditOperationId("operation-2"),
    );
  });

  it("prunes oldest entries at both committed-history caps", () => {
    let history = createEmptyDocumentHistory();
    const released: DocumentHistoryEntry[] = [];
    for (let index = 0; index < DOCUMENT_HISTORY_ENTRY_LIMIT + 5; index += 1) {
      const change = commitDocumentHistory(history, entry(index));
      history = change.history;
      released.push(...change.released);
    }
    expect(history.past).toHaveLength(DOCUMENT_HISTORY_ENTRY_LIMIT);
    expect(released).toHaveLength(5);

    const hugeFirst = commitDocumentHistory(
      createEmptyDocumentHistory(),
      entry(100, DOCUMENT_HISTORY_BYTE_LIMIT),
    );
    const hugeSecond = commitDocumentHistory(hugeFirst.history, entry(101, 1));
    expect(hugeSecond.history.past).toHaveLength(1);
    expect(hugeSecond.history.retainedHistoricalBytes).toBe(1);
  });

  it("keeps history boundaries as deterministic no-ops", () => {
    const empty = createEmptyDocumentHistory();
    expect(undoDocumentHistory(empty)).toMatchObject({
      history: empty,
      snapshot: null,
      entry: null,
    });
    expect(redoDocumentHistory(empty)).toMatchObject({
      history: empty,
      snapshot: null,
      entry: null,
    });
  });

  it("preserves both caps during deterministic randomized history churn", () => {
    let history = createEmptyDocumentHistory();
    let seed = 0x34_20_96;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed;
    };

    for (let index = 0; index < 500; index += 1) {
      const action = random() % 4;
      if (action <= 1) {
        history = commitDocumentHistory(
          history,
          entry(index + 1_000, (random() % 12_000_000) + 1),
        ).history;
      } else if (action === 2) {
        history = undoDocumentHistory(history).history;
      } else {
        history = redoDocumentHistory(history).history;
      }

      expect(history.past.length + history.future.length).toBeLessThanOrEqual(
        DOCUMENT_HISTORY_ENTRY_LIMIT,
      );
      expect(history.retainedHistoricalBytes).toBeLessThanOrEqual(
        DOCUMENT_HISTORY_BYTE_LIMIT,
      );
      expect(history.retainedHistoricalBytes).toBe(
        [...history.past, ...history.future].reduce(
          (total, item) => total + item.estimatedHistoricalBytes,
          0,
        ),
      );
    }
  });
});
