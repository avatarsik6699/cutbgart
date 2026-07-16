import { describe, expect, it } from "vitest";
import {
  MAX_STROKE_PROMPT_SAMPLES,
  sampleSemanticStroke,
  semanticStrokeToPatch,
} from "./semantic-stroke";

describe("semantic strokes", () => {
  it("samples long gestures deterministically with both endpoints", () => {
    const points = Array.from({ length: 100 }, (_, index) => ({ x: index / 99, y: 0.5 }));
    const sampled = sampleSemanticStroke({ id: "s", mode: "keep", points, radius: 2 });
    expect(sampled).toHaveLength(MAX_STROKE_PROMPT_SAMPLES);
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled.at(-1)).toEqual(points.at(-1));
  });

  it("creates a compact bounded hard-constraint patch", () => {
    const patch = semanticStrokeToPatch(
      { id: "s", mode: "remove", points: [{ x: 0.5, y: 0.5 }], radius: 2 },
      100,
      50,
    )!;
    expect(patch.mode).toBe("remove");
    expect(patch.coverage.length).toBeLessThan(100 * 50);
    expect(patch.coverage.some(Boolean)).toBe(true);
  });
});
