import { describe, expect, it } from "vitest";

import { createDocumentId, createMagicDraftId } from "@/editor/domain";

import {
  MAGIC_STROKE_LIMIT,
  MAGIC_STROKE_POINT_LIMIT,
  MagicDraftEngine,
} from "./magic-draft-engine";

function engine(): MagicDraftEngine {
  return new MagicDraftEngine({
    documentId: createDocumentId("document-1"),
    draftId: createMagicDraftId("magic-draft-1"),
    width: 100,
    height: 80,
  });
}

function commitStroke(draft: MagicDraftEngine, id: string, x = 1): void {
  expect(draft.beginStroke({ id, mode: "keep", radius: 10, point: { x, y: 1 } })).toBe(
    true,
  );
  expect(draft.commitStroke()).not.toBeNull();
}

describe("MagicDraftEngine", () => {
  it("simplifies source-space points and hard-caps a live gesture", () => {
    const draft = new MagicDraftEngine({
      documentId: createDocumentId("document-1"),
      draftId: createMagicDraftId("magic-draft-1"),
      width: 2_000,
      height: 1_000,
    });
    draft.beginStroke({ id: "one", mode: "remove", radius: 10, point: { x: 0, y: 0 } });
    expect(draft.appendPoint({ x: 0.1, y: 0.1 })).toBe(false);
    for (let index = 1; index < 800; index += 1) {
      draft.appendPoint({ x: index * 2, y: index });
    }
    const stroke = draft.commitStroke();
    expect(stroke?.points).toHaveLength(MAGIC_STROKE_POINT_LIMIT);
    expect(stroke?.points.at(-1)).toEqual({ x: 1598, y: 799 });
    expect(draft.snapshot()).toMatchObject({ revision: 1, dirty: true, strokeCount: 1 });
  });

  it("bounds the live document and clears redo after a new branch", () => {
    const draft = engine();
    for (let index = 0; index < MAGIC_STROKE_LIMIT; index += 1) {
      commitStroke(draft, `stroke-${index}`, index);
    }
    expect(
      draft.beginStroke({
        id: "overflow",
        mode: "keep",
        radius: 2,
        point: { x: 0, y: 0 },
      }),
    ).toBe(false);
    expect(draft.snapshot().strokeCount).toBe(MAGIC_STROKE_LIMIT);

    expect(draft.undo()).not.toBeNull();
    expect(draft.snapshot()).toMatchObject({ strokeCount: 49, redoCount: 1 });
    commitStroke(draft, "branch");
    expect(draft.snapshot()).toMatchObject({ strokeCount: 50, redoCount: 0 });
  });

  it("keeps gesture cancellation revision-neutral and Undo/Redo monotonic", () => {
    const draft = engine();
    draft.beginStroke({
      id: "cancelled",
      mode: "remove",
      radius: 4,
      point: { x: 2, y: 3 },
    });
    draft.appendPoint({ x: 5, y: 6 });
    expect(draft.cancelStroke()).toBe(true);
    expect(draft.snapshot()).toMatchObject({ revision: 0, dirty: false, strokeCount: 0 });

    commitStroke(draft, "kept");
    expect(draft.undo()).not.toBeNull();
    expect(draft.snapshot()).toMatchObject({ revision: 2, dirty: false, canRedo: true });
    expect(draft.redo()).not.toBeNull();
    expect(draft.snapshot()).toMatchObject({ revision: 3, dirty: true, canUndo: true });
  });

  it("returns copies for prediction and disposes deterministically", () => {
    const draft = engine();
    commitStroke(draft, "one");
    const first = draft.predictionStrokes();
    const second = draft.predictionStrokes();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);

    draft.dispose();
    expect(draft.snapshot()).toMatchObject({ disposed: true, strokeCount: 0 });
    expect(() => draft.predictionStrokes()).toThrow("Magic draft is disposed");
    draft.dispose();
  });
});
