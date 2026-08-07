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

  it("removes crossed background without losing subject alpha inside the hard core", () => {
    const width = 9;
    const height = 3;
    const base = new Uint8ClampedArray(width * height);
    const candidate = base.slice();
    const subjectEdge = 1 * width + 3;
    const backgroundTarget = 1 * width + 4;
    base[subjectEdge] = 255;
    base[backgroundTarget] = 255;
    candidate[subjectEdge] = 255;
    candidate[backgroundTarget] = 0;

    const [result] = rankAndFuseMagicCandidates({
      base,
      strokes: [
        { id: "remove-edge", mode: "remove", radius: 3, points: [{ x: 4, y: 1 }] },
      ],
      candidates: [{ data: candidate.buffer, width, height, score: 1 }],
    });

    expect(result?.data[subjectEdge]).toBe(255);
    expect(result?.data[backgroundTarget]).toBe(0);
    expect(result?.data.every((alpha, index) => alpha <= (base[index] ?? 0))).toBe(true);
  });

  it("restores crossed subject without adding background alpha inside the hard core", () => {
    const width = 9;
    const height = 3;
    const base = new Uint8ClampedArray(width * height);
    const candidate = base.slice();
    const backgroundEdge = 1 * width + 3;
    const subjectTarget = 1 * width + 4;
    candidate[backgroundEdge] = 0;
    candidate[subjectTarget] = 255;

    const [result] = rankAndFuseMagicCandidates({
      base,
      strokes: [{ id: "keep-edge", mode: "keep", radius: 3, points: [{ x: 4, y: 1 }] }],
      candidates: [{ data: candidate.buffer, width, height, score: 1 }],
    });

    expect(result?.data[backgroundEdge]).toBe(0);
    expect(result?.data[subjectTarget]).toBe(255);
    expect(result?.data.every((alpha, index) => alpha >= (base[index] ?? 0))).toBe(true);
  });

  it("materializes only the automatically selected best safe candidate", () => {
    const width = 5;
    const height = 1;
    const candidates = [255, 192, 128].map((alpha, index) => ({
      data: new Uint8ClampedArray(width).fill(alpha).buffer,
      width,
      height,
      score: 1 - index / 10,
    }));

    const ranked = rankAndFuseMagicCandidates({
      base: new Uint8ClampedArray(width),
      strokes: [{ id: "keep", mode: "keep", radius: 1, points: [{ x: 2, y: 0 }] }],
      candidates,
    });

    expect(ranked).toHaveLength(1);
  });
});
