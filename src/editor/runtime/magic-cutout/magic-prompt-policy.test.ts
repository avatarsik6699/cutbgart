import { describe, expect, it } from "vitest";

import type { MagicCutoutRuntimeTypes } from "./magic-cutout.types";
import { createMagicModelPrompts, MAGIC_MODEL_PROMPT_LIMIT } from "./magic-prompt-policy";

describe("createMagicModelPrompts", () => {
  it("keeps small drafts unchanged with semantic labels", () => {
    const strokes: MagicCutoutRuntimeTypes.Stroke[] = [
      { id: "keep", mode: "keep", radius: 4, points: [{ x: 1, y: 2 }] },
      { id: "remove", mode: "remove", radius: 4, points: [{ x: 3, y: 4 }] },
    ];

    expect(createMagicModelPrompts(strokes)).toEqual([
      { label: 1, point: { x: 1, y: 2 } },
      { label: 0, point: { x: 3, y: 4 } },
    ]);
  });

  it("bounds dense histories and retains the latest endpoint of both modes", () => {
    const strokes: MagicCutoutRuntimeTypes.Stroke[] = [
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

  it("samples source-space centrelines fairly across mixed pointer densities", () => {
    const strokes: MagicCutoutRuntimeTypes.Stroke[] = [
      {
        id: "dense-short-keep",
        mode: "keep",
        radius: 4,
        points: Array.from({ length: 80 }, (_unused, index) => ({
          x: (index * 15) / 79,
          y: 1,
        })),
      },
      {
        id: "sparse-long-remove",
        mode: "remove",
        radius: 4,
        points: [
          { x: 0, y: 2 },
          { x: 31, y: 2 },
        ],
      },
    ];

    const prompts = createMagicModelPrompts(strokes);
    const keep = prompts.filter((prompt) => prompt.label === 1);
    const remove = prompts.filter((prompt) => prompt.label === 0);

    expect(prompts).toHaveLength(MAGIC_MODEL_PROMPT_LIMIT);
    expect(keep).toHaveLength(MAGIC_MODEL_PROMPT_LIMIT / 2);
    expect(remove).toHaveLength(MAGIC_MODEL_PROMPT_LIMIT / 2);
    expect(remove).toContainEqual({ label: 0, point: { x: 31, y: 2 } });
    expect(remove.some(({ point }) => point.x > 1 && point.x < 31)).toBe(true);
  });

  it("lets the latest semantic stroke own overlapping centreline prompts", () => {
    const prompts = createMagicModelPrompts([
      {
        id: "keep-first",
        mode: "keep",
        radius: 4,
        points: [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
        ],
      },
      {
        id: "remove-last",
        mode: "remove",
        radius: 4,
        points: [{ x: 2, y: 1 }],
      },
    ]);

    expect(prompts.filter(({ point }) => point.x === 2 && point.y === 1)).toEqual([
      { label: 0, point: { x: 2, y: 1 } },
    ]);
  });
});
