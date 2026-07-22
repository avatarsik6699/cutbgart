import { describe, expect, it } from "vitest";

import { createPromptSession } from "./prompt-session";
import { createRefinementConstraints } from "./refinement-constraints";

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
});
