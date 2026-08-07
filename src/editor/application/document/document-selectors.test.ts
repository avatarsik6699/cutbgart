import { describe, expect, it } from "vitest";

import { buildDocumentSnapshot, buildDocumentState } from "@/editor/testing";
import {
  createEditOperationId,
  createMagicDraftId,
  type DocumentHistoryTypes,
} from "@/editor/domain";

import {
  selectCanRedoDocument,
  selectCanUndoDocument,
  selectHasFutureDocumentHistory,
  selectHasPastDocumentHistory,
} from "./document-selectors";

function snapshotWith(
  state: ReturnType<typeof buildDocumentState>,
): Parameters<typeof selectCanUndoDocument>[0] {
  return { context: { document: state, lastCommandOutcome: null } };
}

function historyEntry(): DocumentHistoryTypes.Entry {
  const before = buildDocumentSnapshot();
  return {
    operationId: createEditOperationId("operation-1"),
    kind: "background",
    before,
    after: { ...before, background: { type: "color", value: "#112233" } },
    estimatedHistoricalBytes: 1,
  };
}

describe("document history selectors", () => {
  it("keeps initial history boundaries disabled", () => {
    const snapshot = snapshotWith(buildDocumentState());
    expect(selectCanUndoDocument(snapshot)).toBe(false);
    expect(selectCanRedoDocument(snapshot)).toBe(false);
  });

  it("exposes committed history without claiming a direct command through a draft", () => {
    const entry = historyEntry();
    const snapshot = snapshotWith(
      buildDocumentState({
        activeDraft: {
          kind: "magic-cutout",
          draftId: createMagicDraftId("magic-draft-1"),
          documentId: buildDocumentState().documentId,
          baselineRevision: 2,
          draftRevision: 0,
          dirty: false,
          status: "ready",
          selectedCandidateId: null,
        },
        history: { past: [entry], future: [entry], retainedHistoricalBytes: 2 },
      }),
    );
    expect(selectHasPastDocumentHistory(snapshot)).toBe(true);
    expect(selectHasFutureDocumentHistory(snapshot)).toBe(true);
    expect(selectCanUndoDocument(snapshot)).toBe(false);
    expect(selectCanRedoDocument(snapshot)).toBe(false);
  });

  it("blocks committed history while a draft has unapplied work", () => {
    const entry = historyEntry();
    const document = buildDocumentState();
    const snapshot = snapshotWith(
      buildDocumentState({
        activeDraft: {
          kind: "magic-cutout",
          draftId: createMagicDraftId("magic-draft-1"),
          documentId: document.documentId,
          baselineRevision: 2,
          draftRevision: 1,
          dirty: true,
          status: "dirty",
          selectedCandidateId: null,
        },
        history: { past: [entry], future: [entry], retainedHistoricalBytes: 2 },
      }),
    );
    expect(selectCanUndoDocument(snapshot)).toBe(false);
    expect(selectCanRedoDocument(snapshot)).toBe(false);
  });
});
