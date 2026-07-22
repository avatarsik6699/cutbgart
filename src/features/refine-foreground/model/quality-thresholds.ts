export const FOREGROUND_QUALITY_THRESHOLDS = {
  alphaRegressionEpsilon: 1e-6,
  boundaryIouRegressionEpsilon: 1e-6,
  minimumMeanColourSpillImprovement: 0.05,
  maximumCaseColourSpillRegression: 0.01,
  maximumInteractionsToAccept: 3,
  maximumCorpusLatencyMs: 2_000,
  maximumMeasuredMemoryDeltaBytes: 256 * 1024 * 1024,
} as const;

export const FOREGROUND_RUNTIME_THRESHOLDS = {
  automaticMs: 180_000,
  coldRefinementMs: 120_000,
  warmRefinementMs: 30_000,
  cleanupMs: 10_000,
} as const;

interface ThresholdMetricSet {
  sad: number;
  mse: number;
  gradient: number;
  connectivity: number;
  boundaryIou: number;
  colourSpill: number;
}

export interface ForegroundThresholdMeasurement {
  caseOrdinal: number;
  baseline: ThresholdMetricSet;
  refined: ThresholdMetricSet;
  interactionsToAccept: number;
  latencyMs: number;
  memoryBytes: number | "unavailable";
}

export interface ForegroundThresholdResult {
  passed: boolean;
  violations: string[];
  meanColourSpillImprovement: number;
}

export function evaluateForegroundQualityThresholds(
  measurements: readonly ForegroundThresholdMeasurement[],
): ForegroundThresholdResult {
  if (measurements.length === 0) {
    return {
      passed: false,
      violations: ["quality corpus is empty"],
      meanColourSpillImprovement: 0,
    };
  }
  const threshold = FOREGROUND_QUALITY_THRESHOLDS;
  const violations: string[] = [];
  let baselineSpill = 0;
  let refinedSpill = 0;
  for (const measurement of measurements) {
    baselineSpill += measurement.baseline.colourSpill;
    refinedSpill += measurement.refined.colourSpill;
    for (const metric of ["sad", "mse", "gradient", "connectivity"] as const) {
      if (
        measurement.refined[metric] - measurement.baseline[metric] >
        threshold.alphaRegressionEpsilon
      ) {
        violations.push(`case ${String(measurement.caseOrdinal)} regressed ${metric}`);
      }
    }
    if (
      measurement.refined.boundaryIou - measurement.baseline.boundaryIou <
      -threshold.boundaryIouRegressionEpsilon
    ) {
      violations.push(`case ${String(measurement.caseOrdinal)} regressed boundary IoU`);
    }
    if (
      measurement.refined.colourSpill >
      measurement.baseline.colourSpill *
        (1 + threshold.maximumCaseColourSpillRegression) +
        threshold.alphaRegressionEpsilon
    ) {
      violations.push(`case ${String(measurement.caseOrdinal)} regressed colour spill`);
    }
    if (measurement.interactionsToAccept > threshold.maximumInteractionsToAccept) {
      violations.push(
        `case ${String(measurement.caseOrdinal)} exceeded interaction threshold`,
      );
    }
    if (measurement.latencyMs > threshold.maximumCorpusLatencyMs) {
      violations.push(
        `case ${String(measurement.caseOrdinal)} exceeded latency threshold`,
      );
    }
    if (
      measurement.memoryBytes !== "unavailable" &&
      measurement.memoryBytes > threshold.maximumMeasuredMemoryDeltaBytes
    ) {
      violations.push(
        `case ${String(measurement.caseOrdinal)} exceeded memory threshold`,
      );
    }
  }
  const meanColourSpillImprovement =
    baselineSpill <= threshold.alphaRegressionEpsilon
      ? refinedSpill <= threshold.alphaRegressionEpsilon
        ? 1
        : 0
      : (baselineSpill - refinedSpill) / baselineSpill;
  if (meanColourSpillImprovement < threshold.minimumMeanColourSpillImprovement) {
    violations.push("mean colour-spill improvement was below threshold");
  }
  return {
    passed: violations.length === 0,
    violations,
    meanColourSpillImprovement,
  };
}
