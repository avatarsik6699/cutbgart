import { describe, expect, it } from "vitest";

import {
  createMagicConstraints,
  rankAndFuseMagicCandidates,
} from "./magic-candidate-policy";

describe("Magic candidate policy", () => {
  it("applies latest semantic constraints in source space", () => {
    const constraints = createMagicConstraints(
      [
        { id: "keep", mode: "keep", radius: 1, points: [{ x: 2, y: 1 }] },
        { id: "remove", mode: "remove", radius: 1, points: [{ x: 2, y: 1 }] },
      ],
      5,
      3,
    );

    expect(constraints.hard[1 * 5 + 2]).toBe(0);
    expect(constraints.influence[1 * 5 + 2]).toBe(0);
  });

  it("ranks by constraint agreement and fuses only influenced base pixels", () => {
    const width = 7;
    const height = 3;
    const base = new Uint8ClampedArray(width * height).fill(128);
    const wrong = new Uint8ClampedArray(width * height);
    wrong.fill(0);
    wrong[1 * width + 5] = 255;
    const right = new Uint8ClampedArray(width * height);
    right.fill(0);
    right[1 * width + 1] = 255;

    const ranked = rankAndFuseMagicCandidates({
      base,
      strokes: [
        { id: "keep", mode: "keep", radius: 1, points: [{ x: 1, y: 1 }] },
        { id: "remove", mode: "remove", radius: 1, points: [{ x: 5, y: 1 }] },
      ],
      candidates: [
        { data: wrong.buffer, width, height, score: 0.9 },
        { data: right.buffer, width, height, score: 0.4 },
      ],
    });

    expect(ranked[0]?.score).toBe(0.4);
    expect(ranked[0]?.data[1 * width + 1]).toBe(255);
    expect(ranked[0]?.data[1 * width + 5]).toBe(0);
    expect(ranked[0]?.data[0]).toBe(128);
  });
});
