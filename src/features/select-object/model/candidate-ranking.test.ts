import { describe, expect, it } from "vitest";

import { localCandidateDifference, rankGuidedBrushCandidates } from "./candidate-ranking";

const region = { x: 0, y: 0, width: 2, height: 2 };
const constraints = {
  width: 4,
  height: 2,
  data: new Int8Array([1, 0, -1, -1, 1, 0, -1, -1]),
};
const influence = {
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
      influence,
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
      rankGuidedBrushCandidates(
        [reference, outsideOnly],
        constraints,
        region,
        null,
        influence,
      ),
    ).toHaveLength(1);
  });

  it("ignores candidate changes between separated local influence zones", () => {
    const left = candidate("left", [255, 0, 255, 255, 255, 0, 255, 255], 1);
    const right = candidate("right", [255, 0, 0, 0, 255, 0, 0, 0], 0.5);
    const localInfluence = {
      width: 4,
      height: 2,
      data: new Int8Array([1, 0, -1, -1, 1, 0, -1, -1]),
    };
    expect(
      localCandidateDifference(
        left.matte,
        right.matte,
        { x: 0, y: 0, width: 4, height: 2 },
        localInfluence,
      ),
    ).toBe(0);
  });

  it("uses safe fused continuity before the model's raw-score tie-breaker", () => {
    const base = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([255, 0, 0, 0, 255, 0, 0, 0]),
    };
    const keepConstraints = {
      width: 4,
      height: 2,
      data: new Int8Array([1, -1, -1, -1, 1, -1, -1, -1]),
    };
    const keepInfluence = {
      width: 4,
      height: 2,
      data: new Int8Array([1, 1, -1, -1, 1, 1, -1, -1]),
    };
    const ranked = rankGuidedBrushCandidates(
      [
        candidate("different", [255, 255, 0, 0, 255, 255, 0, 0], 10),
        candidate("continuous", [...base.data], -10),
      ],
      keepConstraints,
      region,
      base,
      keepInfluence,
    );
    expect(ranked[0]?.id).toBe("continuous");
  });

  it("ranks and collapses directional outcomes after destructive Keep deltas are neutralized", () => {
    const base = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray(8).fill(255),
    };
    const keepConstraints = {
      width: 4,
      height: 2,
      data: new Int8Array([1, -1, -1, -1, 1, -1, -1, -1]),
    };
    const keepInfluence = {
      width: 4,
      height: 2,
      data: new Int8Array([1, 1, -1, -1, 1, 1, -1, -1]),
    };
    const ranked = rankGuidedBrushCandidates(
      [
        candidate("holey", [255, 0, 0, 0, 255, 0, 0, 0], 10),
        candidate("safe", [...base.data], 1),
      ],
      keepConstraints,
      region,
      base,
      keepInfluence,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.matte.data).toEqual(base.data);
  });
});
