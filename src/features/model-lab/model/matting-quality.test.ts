import { describe, expect, it } from "vitest";

import { measureMattingQuality } from "./matting-quality";

function matte(values: number[]) {
  return { width: 2, height: 2, data: Uint8ClampedArray.from(values) };
}

describe("matting quality", () => {
  it("returns perfect normalized scores for identical alpha", () => {
    const value = matte([0, 64, 192, 255]);
    const result = measureMattingQuality({
      caseOrdinal: 1,
      modelId: "vitmatte-small-composition1k-q8",
      predicted: value,
      expected: value,
    });
    expect(result).toMatchObject({
      iou: 1,
      boundaryIou: 1,
      sad: 0,
      mse: 0,
      gradient: 0,
      connectivity: 0,
      interactionsToAccept: null,
    });
  });

  it("reports bounded finite errors for a mismatched alpha", () => {
    const result = measureMattingQuality({
      caseOrdinal: 2,
      modelId: "vitmatte-small-distinctions646-fp32",
      predicted: matte([0, 0, 0, 0]),
      expected: matte([0, 255, 255, 255]),
    });
    expect(result.iou).toBe(0);
    expect(result.sad).toBeCloseTo(0.003);
    expect(result.mse).toBeCloseTo(0.75);
    for (const value of [result.boundaryIou, result.gradient, result.connectivity]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("rejects mismatched dimensions", () => {
    expect(() =>
      measureMattingQuality({
        caseOrdinal: 1,
        modelId: "vitmatte-small-composition1k-q8",
        predicted: matte([0, 0, 0, 0]),
        expected: { width: 1, height: 1, data: new Uint8ClampedArray([0]) },
      }),
    ).toThrow(/equally sized/i);
  });
});
