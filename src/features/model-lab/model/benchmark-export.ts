import { getEvaluationModel, getInteractiveEvaluationModel } from "./model-registry";
import type {
  BenchmarkExport,
  BenchmarkMeasurement,
  BenchmarkPreference,
  EvaluationModelId,
  InteractiveEvaluationModelId,
  InteractiveMattingBenchmarkExport,
  InteractiveRuntimeMeasurement,
  MattingQualityMeasurement,
  ModelLabCapabilities,
} from "./types";

export function createBenchmarkExport(input: {
  createdAt?: Date;
  capabilities: ModelLabCapabilities;
  selectedModelIds: EvaluationModelId[];
  imageCount: number;
  measurements: BenchmarkMeasurement[];
  preferences: BenchmarkPreference[];
}): BenchmarkExport {
  return {
    schemaVersion: 1,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    capabilities: input.capabilities,
    models: input.selectedModelIds.map((id) => {
      const model = getEvaluationModel(id);
      return { id, revision: model.revision, dtype: model.dtype };
    }),
    imageCount: input.imageCount,
    measurements: input.measurements.map((measurement) => ({ ...measurement })),
    preferences: input.preferences.map((preference) => ({ ...preference })),
  };
}

export function serializeBenchmarkExport(value: BenchmarkExport): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function createInteractiveBenchmarkExport(input: {
  createdAt?: Date;
  capabilities: ModelLabCapabilities;
  selectedModelIds: InteractiveEvaluationModelId[];
  corpusCaseCount: number;
  quality: MattingQualityMeasurement[];
  runtime: InteractiveRuntimeMeasurement[];
  decision: InteractiveEvaluationModelId | "none";
}): InteractiveMattingBenchmarkExport {
  return {
    schemaVersion: 2,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    capabilities: input.capabilities,
    candidates: input.selectedModelIds.map((id) => ({
      ...getInteractiveEvaluationModel(id),
    })),
    corpusCaseCount: input.corpusCaseCount,
    quality: input.quality.map((measurement) => ({ ...measurement })),
    runtime: input.runtime.map((measurement) => ({ ...measurement })),
    decision: input.decision,
  };
}

export function serializeInteractiveBenchmarkExport(
  value: InteractiveMattingBenchmarkExport,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function downloadBenchmarkExport(value: BenchmarkExport): void {
  const blob = new Blob([serializeBenchmarkExport(value)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cutbg-model-benchmark-${value.createdAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadInteractiveBenchmarkExport(
  value: InteractiveMattingBenchmarkExport,
): void {
  const blob = new Blob([serializeInteractiveBenchmarkExport(value)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cutbg-matting-benchmark-${value.createdAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
