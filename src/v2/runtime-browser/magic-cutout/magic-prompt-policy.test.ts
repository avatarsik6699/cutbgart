import { describe, expect, it } from "vitest";

import type { MagicStroke } from "./magic-cutout.types";
import { createMagicModelPrompts, MAGIC_MODEL_PROMPT_LIMIT } from "./magic-prompt-policy";

describe("createMagicModelPrompts", () => {
  it("keeps small drafts unchanged with semantic labels", () => {
    const strokes: MagicStroke[] = [
      { id: "keep", mode: "keep", radius: 4, points: [{ x: 1, y: 2 }] },
      { id: "remove", mode: "remove", radius: 4, points: [{ x: 3, y: 4 }] },
    ];

    expect(createMagicModelPrompts(strokes)).toEqual([
      { label: 1, point: { x: 1, y: 2 } },
      { label: 0, point: { x: 3, y: 4 } },
    ]);
  });

  it("bounds dense histories and retains the latest endpoint of both modes", () => {
    const strokes: MagicStroke[] = [
      {
        id: "keep",
        mode: "keep",
        radius: 4,
        points: Array.from({ length: 80 }, (_unused, index) => ({ x: index, y: 1 })),
      },
      {
        id: "remove",
        mode: "remove",
        radius: 4,
        points: Array.from({ length: 80 }, (_unused, index) => ({ x: index, y: 2 })),
      },
    ];

    const prompts = createMagicModelPrompts(strokes);

    expect(prompts).toHaveLength(MAGIC_MODEL_PROMPT_LIMIT);
    expect(prompts).toContainEqual({ label: 1, point: { x: 79, y: 1 } });
    expect(prompts).toContainEqual({ label: 0, point: { x: 79, y: 2 } });
  });
});
