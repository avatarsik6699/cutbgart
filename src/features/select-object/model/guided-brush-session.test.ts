import { describe, expect, it } from "vitest";

import {
  GUIDED_BRUSH_HISTORY_LIMIT,
  GUIDED_BRUSH_POINT_LIMIT,
  GUIDED_BRUSH_STROKE_LIMIT,
  appendGuidedBrushStroke,
  canAcceptGuidedBrushSession,
  clearGuidedBrushStrokes,
  continueGuidedBrushFromResult,
  createGuidedBrushSession,
  createGuidedBrushViewSession,
  redoGuidedBrushStroke,
  selectGuidedBrushCandidate,
  setGuidedBrushCandidates,
  setGuidedBrushRadius,
  undoGuidedBrushStroke,
} from "./guided-brush-session";

const source = {
  blob: new Blob(),
  width: 8,
  height: 8,
  format: "image/png" as const,
};
const stroke = (id: string) => ({
  id,
  mode: "keep" as const,
  points: [{ x: 0.5, y: 0.5 }],
  radius: 2,
});

describe("guided brush session", () => {
  it("keeps brush size future-only and marks gesture/history changes dirty", () => {
    const initial = createGuidedBrushSession(source);
    const resized = setGuidedBrushRadius(initial, 9.4);
    expect(resized.brushRadius).toBe(9);
    expect(resized.revision).toBe(initial.revision);
    const painted = appendGuidedBrushStroke(resized, stroke("a"));
    expect(painted).toMatchObject({ status: "dirty", revision: 1 });
    const undone = undoGuidedBrushStroke(painted);
    expect(undone.strokes).toHaveLength(0);
    expect(undone.redo).toHaveLength(1);
    expect(redoGuidedBrushStroke(undone).strokes).toHaveLength(1);
    expect(clearGuidedBrushStrokes(painted)).toMatchObject({
      strokes: [],
      history: [],
      redo: [],
      status: "dirty",
    });
  });

  it("bounds delta history and disables acceptance when markings are newer", () => {
    let session = createGuidedBrushSession(source);
    for (let index = 0; index < GUIDED_BRUSH_HISTORY_LIMIT + 5; index += 1)
      session = appendGuidedBrushStroke(session, stroke(String(index)));
    expect(session.history).toHaveLength(GUIDED_BRUSH_HISTORY_LIMIT);
    expect(session.strokes).toHaveLength(GUIDED_BRUSH_STROKE_LIMIT);
    const oversized = appendGuidedBrushStroke(createGuidedBrushSession(source), {
      ...stroke("oversized"),
      points: Array.from({ length: GUIDED_BRUSH_POINT_LIMIT + 10 }, (_, index) => ({
        x: index / GUIDED_BRUSH_POINT_LIMIT,
        y: 0.5,
      })),
    });
    expect(oversized.strokes[0]?.points).toHaveLength(GUIDED_BRUSH_POINT_LIMIT);

    const candidate = {
      id: "best",
      matte: { width: 8, height: 8, data: new Uint8ClampedArray(64) },
      modelRankScore: 4.2,
      intentScore: 1,
      differenceRatio: 0,
      foregroundRatio: 0.5,
    };
    const painted = appendGuidedBrushStroke(
      createGuidedBrushSession(source),
      stroke("a"),
    );
    const computed = setGuidedBrushCandidates(painted, [candidate], {
      x: 0,
      y: 0,
      width: 8,
      height: 8,
    });
    expect(canAcceptGuidedBrushSession(computed)).toBe(true);
    const view = createGuidedBrushViewSession(computed);
    expect(view.hasBaseMatte).toBe(false);
    expect(view.candidates[0]).not.toHaveProperty("matte");
    expect(selectGuidedBrushCandidate(computed, "missing").selectedCandidateId).toBe(
      "best",
    );
    expect(
      canAcceptGuidedBrushSession(appendGuidedBrushStroke(computed, stroke("new"))),
    ).toBe(false);

    const continued = continueGuidedBrushFromResult(computed, candidate.matte);
    expect(continued).toMatchObject({
      baseMatte: candidate.matte,
      strokes: [],
      candidates: [],
      selectedCandidateId: null,
      history: [],
      redo: [],
      status: "preview",
      revision: computed.revision + 1,
      computedRevision: computed.revision + 1,
    });
    expect(canAcceptGuidedBrushSession(continued)).toBe(true);
    expect(continueGuidedBrushFromResult(continued, candidate.matte)).toBe(continued);
  });
});
