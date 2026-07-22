import { describe, expect, it } from "vitest";

import {
  FOREGROUND_QUALITY_THRESHOLDS,
  evaluateForegroundQualityThresholds,
} from "./quality-thresholds";

describe("foreground quality thresholds", () => {
  it("passes non-regressing measurements with meaningful spill improvement", () => {
    const metrics = {
      sad: 0,
      mse: 0,
      gradient: 0,
      connectivity: 0,
      boundaryIou: 1,
    };
    const measurements = [1, 2].map((caseOrdinal) => ({
      caseOrdinal,
      baseline: { ...metrics, colourSpill: 0.2 },
      refined: { ...metrics, colourSpill: 0.1 },
      interactionsToAccept: 1,
      latencyMs: 10,
      memoryBytes: "unavailable" as const,
    }));
    const result = evaluateForegroundQualityThresholds(measurements);
    expect(result.violations).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.meanColourSpillImprovement).toBeGreaterThanOrEqual(
      FOREGROUND_QUALITY_THRESHOLDS.minimumMeanColourSpillImprovement,
    );
  });

  it("reports quality, interaction, latency, and measured-memory regressions", () => {
    const result = evaluateForegroundQualityThresholds([
      {
        caseOrdinal: 7,
        baseline: {
          sad: 0,
          mse: 0,
          gradient: 0,
          connectivity: 0,
          boundaryIou: 1,
          colourSpill: 0.1,
        },
        refined: {
          sad: 1,
          mse: 1,
          gradient: 1,
          connectivity: 1,
          boundaryIou: 0,
          colourSpill: 0.2,
        },
        interactionsToAccept: 4,
        latencyMs: 2_001,
        memoryBytes: FOREGROUND_QUALITY_THRESHOLDS.maximumMeasuredMemoryDeltaBytes + 1,
      },
    ]);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(10);
  });
});
