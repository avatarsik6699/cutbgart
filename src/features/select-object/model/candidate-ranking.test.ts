import { describe, expect, it } from "vitest";

import { localCandidateDifference, rankGuidedBrushCandidates } from "./candidate-ranking";

const region = { x: 0, y: 0, width: 2, height: 2 };
const constraints = {
  width: 4,
  height: 2,
  data: new Int8Array([1, 0, -1, -1, 1, 0, -1, -1]),
};
const candidate = (id: string, data: number[], score: number | null) => ({
  id,
  matte: { width: 4, height: 2, data: new Uint8ClampedArray(data) },
  score,
  differenceRatio: 0,
});

describe("guided candidate ranking", () => {
  it("ranks intent before arbitrary finite raw score and keeps raw values internal", () => {
    const ranked = rankGuidedBrushCandidates(
      [
        candidate("high-raw-bad-intent", [0, 255, 0, 0, 0, 255, 0, 0], 8.5),
        candidate("good-intent", [255, 0, 0, 0, 255, 0, 0, 0], -3.2),
      ],
      constraints,
      region,
      null,
    );
    expect(ranked[0]).toMatchObject({
      id: "good-intent",
      modelRankScore: -3.2,
      intentScore: 1,
    });
  });

  it("uses local differences and collapses materially identical alternatives", () => {
    const reference = candidate("reference", [255, 0, 0, 0, 255, 0, 0, 0], 1);
    const outsideOnly = candidate(
      "outside-only",
      [255, 0, 255, 255, 255, 0, 255, 255],
      0.5,
    );
    expect(localCandidateDifference(reference.matte, outsideOnly.matte, region)).toBe(0);
    expect(
      rankGuidedBrushCandidates([reference, outsideOnly], constraints, region, null),
    ).toHaveLength(1);
  });

  it("ignores candidate changes between separated local influence zones", () => {
    const left = candidate("left", [255, 0, 255, 255, 255, 0, 255, 255], 1);
    const right = candidate("right", [255, 0, 0, 0, 255, 0, 0, 0], 0.5);
    const influenceMask = new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0]);
    expect(
      localCandidateDifference(
        left.matte,
        right.matte,
        { x: 0, y: 0, width: 4, height: 2 },
        influenceMask,
      ),
    ).toBe(0);
  });

  it("uses automatic-base continuity before the model's raw-score tie-breaker", () => {
    const base = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([255, 0, 0, 0, 255, 0, 0, 0]),
    };
    const ranked = rankGuidedBrushCandidates(
      [
        candidate("different", [128, 127, 0, 0, 128, 127, 0, 0], 10),
        candidate("continuous", [...base.data], -10),
      ],
      constraints,
      region,
      base,
    );
    expect(ranked[0]?.id).toBe("continuous");
  });
});
