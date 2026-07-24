import { describe, expect, it } from "vitest";
import {
  displayPointToNormalized,
  maskCandidates,
  normalizedBoxToPixels,
  normalizedPointToPixels,
} from "./prompt-coordinates";

describe("guided prompt geometry", () => {
  it("maps responsive display coordinates and clamps outside input", () => {
    expect(
      displayPointToNormalized(150, 100, { left: 50, top: 50, width: 200, height: 100 }),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(
      displayPointToNormalized(0, 999, { left: 50, top: 50, width: 200, height: 100 }),
    ).toEqual({ x: 0, y: 1 });
  });

  it("normalizes box direction and scales to source pixels", () => {
    expect(
      normalizedBoxToPixels({ xMin: 0.8, yMin: 0.7, xMax: 0.2, yMax: 0.1 }, 1000, 500),
    ).toEqual({ xMin: 200, yMin: 50, xMax: 800, yMax: 350 });
    expect(normalizedPointToPixels({ x: 0.25, y: 0.5, label: 0 }, 100, 50)).toEqual({
      x: 25,
      y: 25,
      label: 0,
    });
  });

  it("returns all source-sized masks ordered by IoU", () => {
    const candidates = maskCandidates([1, 0, 0, 1, 0, 1, 1, 0], [0.2, 0.9], 2, 2, 7);
    expect(
      candidates.map(({ id, score, differenceRatio }) => ({
        id,
        score,
        differenceRatio,
      })),
    ).toEqual([
      { id: "candidate-7-1", score: 0.9, differenceRatio: 0 },
      { id: "candidate-7-0", score: 0.2, differenceRatio: 1 },
    ]);
    expect(candidates[0]!.matte.data).toEqual(new Uint8ClampedArray([0, 255, 255, 0]));
  });

  it("keeps invalid model quality unavailable without rendering invented confidence", () => {
    const candidates = maskCandidates([1, 0, 0, 1], [Number.NaN], 2, 2, 8);
    expect(candidates[0]).toMatchObject({ score: null, differenceRatio: 0 });
  });
});
