import { describe, expect, it } from "vitest";

import { createPromptSession } from "./prompt-session";
import {
  createGuidedBrushConstraints,
  createRefinementConstraints,
} from "./refinement-constraints";
import { createGuidedBrushSession } from "./guided-brush-session";

describe("guided refinement constraints", () => {
  it("returns null without explicit strokes", () => {
    expect(
      createRefinementConstraints(
        createPromptSession(
          { blob: new Blob(), width: 5, height: 5, format: "image/png" },
          null,
        ),
      ),
    ).toBeNull();
  });

  it("lets the latest keep/remove stroke win on overlap", () => {
    const session = createPromptSession(
      { blob: new Blob(), width: 7, height: 7, format: "image/png" },
      null,
    );
    const layer = session.layers[0]!;
    const keep = {
      id: "keep",
      mode: "keep" as const,
      points: [{ x: 0.5, y: 0.5 }],
      radius: 1,
    };
    const remove = {
      id: "remove",
      mode: "remove" as const,
      points: [{ x: 0.5, y: 0.5 }],
      radius: 1,
    };
    const map = createRefinementConstraints({
      ...session,
      layers: [{ ...layer, strokes: [keep, remove] }],
      history: [
        { type: "stroke-added", layerId: layer.id, stroke: keep },
        { type: "stroke-added", layerId: layer.id, stroke: remove },
      ],
    });
    expect(map?.data[3 * 7 + 3]).toBe(0);
  });

  it("builds downstream constraints from the Phase-21 brush session", () => {
    const source = {
      blob: new Blob(),
      width: 7,
      height: 7,
      format: "image/png" as const,
    };
    const session = {
      ...createGuidedBrushSession(source),
      strokes: [
        {
          id: "keep",
          mode: "keep" as const,
          points: [{ x: 0.5, y: 0.5 }],
          radius: 1,
        },
      ],
    };
    expect(createGuidedBrushConstraints(session)?.data[3 * 7 + 3]).toBe(1);
  });
});
