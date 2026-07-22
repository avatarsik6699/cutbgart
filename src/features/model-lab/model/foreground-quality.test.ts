import { describe, expect, it } from "vitest";

import { buildSyntheticCasePixels } from "./matting-corpus";
import { measureForegroundEdgeQuality } from "./foreground-quality";

describe("foreground edge quality", () => {
  it("records baseline/refined/delta alpha and colour metrics without inventing memory", () => {
    const synthetic = buildSyntheticCasePixels("hair-fur", 16);
    const baselineMatte = {
      ...synthetic.groundTruth,
      data: synthetic.groundTruth.data.map((alpha) => Math.max(0, alpha - 20)),
    };
    const result = measureForegroundEdgeQuality({
      caseOrdinal: 1,
      baselineMatte,
      refinedMatte: synthetic.groundTruth,
      expectedMatte: synthetic.groundTruth,
      baselineRgba: synthetic.pixels,
      refinedRgba: synthetic.expectedForeground,
      expectedForegroundRgba: synthetic.expectedForeground,
      interactionsToAccept: 2,
      latencyMs: 12.5,
      memoryBytes: "unavailable",
    });

    expect(result.baseline.sad).toBeGreaterThan(0);
    expect(result.refined.sad).toBe(0);
    expect(result.delta.sad).toBeLessThan(0);
    expect(result.baseline.colourSpill).toBeGreaterThan(0);
    expect(result.refined.colourSpill).toBe(0);
    expect(result.delta.colourSpill).toBeLessThan(0);
    expect(result).toMatchObject({
      interactionsToAccept: 2,
      latencyMs: 12.5,
      memoryBytes: "unavailable",
    });
  });

  it("rejects RGBA buffers that do not match the corpus dimensions", () => {
    const synthetic = buildSyntheticCasePixels("holes", 8);
    expect(() =>
      measureForegroundEdgeQuality({
        caseOrdinal: 1,
        baselineMatte: synthetic.groundTruth,
        refinedMatte: synthetic.groundTruth,
        expectedMatte: synthetic.groundTruth,
        baselineRgba: new Uint8ClampedArray(4),
        refinedRgba: synthetic.pixels,
        expectedForegroundRgba: synthetic.expectedForeground,
        interactionsToAccept: 0,
        latencyMs: 0,
        memoryBytes: "unavailable",
      }),
    ).toThrow(/dimensions must match/);
  });
});
