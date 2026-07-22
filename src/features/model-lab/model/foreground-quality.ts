import type { AlphaMatte } from "../../../entities/processed-image";
import { measureMattingQuality } from "./matting-quality";
import type { ForegroundEdgeMetricSet, ForegroundEdgeQualityMeasurement } from "./types";

function assertRgba(name: string, rgba: Uint8ClampedArray, matte: AlphaMatte): void {
  if (rgba.length !== matte.width * matte.height * 4) {
    throw new Error(`${name} dimensions must match the quality matte`);
  }
}

function colourSpillError(
  rgba: Uint8ClampedArray,
  expected: Uint8ClampedArray,
  alpha: AlphaMatte,
): number {
  let total = 0;
  let samples = 0;
  const maximumDistance = Math.sqrt(3 * 255 * 255);
  for (let index = 0; index < alpha.data.length; index += 1) {
    const value = alpha.data[index] ?? 0;
    if (value === 0 || value === 255) continue;
    const offset = index * 4;
    const red = (rgba[offset] ?? 0) - (expected[offset] ?? 0);
    const green = (rgba[offset + 1] ?? 0) - (expected[offset + 1] ?? 0);
    const blue = (rgba[offset + 2] ?? 0) - (expected[offset + 2] ?? 0);
    total += Math.hypot(red, green, blue) / maximumDistance;
    samples += 1;
  }
  return samples === 0 ? 0 : total / samples;
}

function alphaMetricSet(
  caseOrdinal: number,
  predicted: AlphaMatte,
  expected: AlphaMatte,
  colourSpill: number,
): ForegroundEdgeMetricSet {
  const measured = measureMattingQuality({
    caseOrdinal,
    modelId: "vitmatte-small-distinctions646-q8",
    predicted,
    expected,
  });
  return {
    sad: measured.sad ?? 0,
    mse: measured.mse ?? 0,
    gradient: measured.gradient ?? 0,
    connectivity: measured.connectivity ?? 0,
    boundaryIou: measured.boundaryIou ?? 0,
    colourSpill,
  };
}

export function measureForegroundEdgeQuality(input: {
  caseOrdinal: number;
  baselineMatte: AlphaMatte;
  refinedMatte: AlphaMatte;
  expectedMatte: AlphaMatte;
  baselineRgba: Uint8ClampedArray;
  refinedRgba: Uint8ClampedArray;
  expectedForegroundRgba: Uint8ClampedArray;
  interactionsToAccept: number;
  latencyMs: number;
  memoryBytes: number | "unavailable";
}): ForegroundEdgeQualityMeasurement {
  assertRgba("Baseline RGBA", input.baselineRgba, input.expectedMatte);
  assertRgba("Refined RGBA", input.refinedRgba, input.expectedMatte);
  assertRgba(
    "Expected foreground RGBA",
    input.expectedForegroundRgba,
    input.expectedMatte,
  );
  const baseline = alphaMetricSet(
    input.caseOrdinal,
    input.baselineMatte,
    input.expectedMatte,
    colourSpillError(
      input.baselineRgba,
      input.expectedForegroundRgba,
      input.expectedMatte,
    ),
  );
  const refined = alphaMetricSet(
    input.caseOrdinal,
    input.refinedMatte,
    input.expectedMatte,
    colourSpillError(
      input.refinedRgba,
      input.expectedForegroundRgba,
      input.expectedMatte,
    ),
  );
  const keys = Object.keys(baseline) as Array<keyof ForegroundEdgeMetricSet>;
  const delta = Object.fromEntries(
    keys.map((key) => [key, refined[key] - baseline[key]]),
  ) as unknown as ForegroundEdgeMetricSet;
  return {
    caseOrdinal: input.caseOrdinal,
    baseline,
    refined,
    delta,
    interactionsToAccept: input.interactionsToAccept,
    latencyMs: input.latencyMs,
    memoryBytes: input.memoryBytes,
  };
}
