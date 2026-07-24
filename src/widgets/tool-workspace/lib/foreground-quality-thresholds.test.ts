import { describe, expect, it } from "vitest";

import {
  SYNTHETIC_MATTING_CATEGORIES,
  buildSyntheticCasePixels,
  measureForegroundEdgeQuality,
} from "../../../features/model-lab";
import {
  FOREGROUND_QUALITY_THRESHOLDS,
  estimateForegroundPixels,
  evaluateForegroundQualityThresholds,
} from "../../../features/refine-foreground";

describe("complete foreground edge corpus", () => {
  it("meets the enforced quality, interaction, latency, and memory thresholds", () => {
    const measurements = SYNTHETIC_MATTING_CATEGORIES.map((category, index) => {
      const synthetic = buildSyntheticCasePixels(category);
      const startedAt = performance.now();
      const refined = estimateForegroundPixels({
        rgba: synthetic.pixels,
        matte: synthetic.groundTruth,
        componentCleanup: false,
      });
      const latencyMs = performance.now() - startedAt;
      expect(refined.matte.data).toEqual(synthetic.groundTruth.data);
      return measureForegroundEdgeQuality({
        caseOrdinal: index + 1,
        baselineMatte: synthetic.groundTruth,
        refinedMatte: refined.matte,
        expectedMatte: synthetic.groundTruth,
        baselineRgba: synthetic.pixels,
        refinedRgba: refined.rgba,
        expectedForegroundRgba: synthetic.expectedForeground,
        interactionsToAccept: 1,
        latencyMs,
        memoryBytes: "unavailable",
      });
    });
    const result = evaluateForegroundQualityThresholds(measurements);
    expect(result.violations).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.meanColourSpillImprovement).toBeGreaterThanOrEqual(
      FOREGROUND_QUALITY_THRESHOLDS.minimumMeanColourSpillImprovement,
    );
  });
});
