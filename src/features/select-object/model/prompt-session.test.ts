import { describe, expect, it } from "vitest";
import {
  addLayer,
  appendPoint,
  appendStroke,
  createPromptSession,
  PROMPT_HISTORY_LIMIT,
  redoPrompt,
  removeLayer,
  selectLayer,
  setTargetBox,
  undoPrompt,
} from "./prompt-session";

const source = { blob: new Blob(), width: 4, height: 3, format: "image/png" as const };

describe("prompt session", () => {
  it("keeps cumulative prompt deltas and bounded undo/redo history", () => {
    let session = createPromptSession(source, null, "one");
    session = appendPoint(session, { id: "p1", x: 0.2, y: 0.3, label: 1 });
    session = appendPoint(session, { id: "p2", x: 0.8, y: 0.7, label: 0 });
    session = setTargetBox(session, { xMin: 0.1, yMin: 0.1, xMax: 0.9, yMax: 0.9 });
    session = appendStroke(session, {
      id: "s1",
      mode: "keep",
      points: [{ x: 0.5, y: 0.5 }],
      radius: 2,
    });
    expect(session.layers[0]).toMatchObject({
      points: [{ label: 1 }, { label: 0 }],
      targetBox: { xMin: 0.1 },
      strokes: [{ id: "s1" }],
    });
    expect(session.history.every((entry) => !("matte" in entry))).toBe(true);
    session = undoPrompt(session);
    expect(session.layers[0]!.strokes).toHaveLength(0);
    session = redoPrompt(session);
    expect(session.layers[0]!.strokes).toHaveLength(1);
    for (let index = 0; index < PROMPT_HISTORY_LIMIT + 5; index += 1)
      session = appendPoint(session, {
        id: `extra-${String(index)}`,
        x: 0,
        y: 0,
        label: 1,
      });
    expect(session.history).toHaveLength(PROMPT_HISTORY_LIMIT);
  });

  it("restores compact layer prompt data and never leaks across a new source", () => {
    let session = createPromptSession(source, null, "one");
    session = appendPoint(session, { id: "p1", x: 0.2, y: 0.3, label: 1 });
    session = addLayer(session, "two");
    session = selectLayer(session, "one");
    session = removeLayer(session, "one");
    expect(session.layers.map((layer) => layer.id)).toEqual(["two"]);
    session = undoPrompt(session);
    expect(session.layers[0]).toMatchObject({
      id: "one",
      points: [{ id: "p1" }],
      candidates: [],
      acceptedMatte: null,
    });
    const other = createPromptSession(
      { ...source, blob: new Blob(["new"]) },
      null,
      "fresh",
    );
    expect(other).toMatchObject({ activeLayerId: "fresh", history: [], redo: [] });
    expect(other.layers).toHaveLength(1);
  });
});
