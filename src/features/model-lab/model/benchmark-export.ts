import { getEvaluationModel } from "./model-registry";
import type {
  BenchmarkExport,
  BenchmarkMeasurement,
  BenchmarkPreference,
  EvaluationModelId,
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
