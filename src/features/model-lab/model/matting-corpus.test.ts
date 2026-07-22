import { describe, expect, it } from "vitest";

import { SYNTHETIC_MATTING_CATEGORIES, buildSyntheticCasePixels } from "./matting-corpus";

describe("synthetic matting corpus", () => {
  it("covers every required category with deterministic local pixels", () => {
    expect(SYNTHETIC_MATTING_CATEGORIES).toEqual([
      "hair-fur",
      "transparent-thin",
      "holes",
      "shadows",
      "light-on-light",
      "multiple-objects",
      "motion-blur",
      "high-resolution-small-target",
    ]);
    for (const category of SYNTHETIC_MATTING_CATEGORIES) {
      const first = buildSyntheticCasePixels(category, 32);
      const second = buildSyntheticCasePixels(category, 32);
      expect(first.pixels).toEqual(second.pixels);
      expect(first.groundTruth.data).toEqual(second.groundTruth.data);
      expect(new Set(first.groundTruth.data).size).toBeGreaterThan(1);
    }
  });
});
