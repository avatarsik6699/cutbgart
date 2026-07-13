import type { EvaluationModelId, EvaluationModelProfile } from "./types";

const ALL_BROWSER_PATHS = ["webgpu", "wasm"] as const;

export const EVALUATION_MODELS = [
  {
    id: "isnet-q8",
    label: "IS-Net q8",
    modelId: "onnx-community/ISNet-ONNX",
    revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
    dtype: "q8",
    approximateBytes: 44_348_381,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "AGPL-3.0",
    resourceWarning: "Быстрый действующий baseline, около 44 МБ.",
  },
  {
    id: "isnet-fp32",
    label: "IS-Net fp32",
    modelId: "onnx-community/ISNet-ONNX",
    revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
    dtype: "fp32",
    approximateBytes: 176_114_856,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "AGPL-3.0",
    resourceWarning: "Полноточный действующий baseline, около 176 МБ.",
  },
  {
    id: "ben2-fp16",
    label: "BEN2 fp16",
    modelId: "onnx-community/BEN2-ONNX",
    revision: "c552aa82688edce09f0ac9d2e31ad53d9d629010",
    dtype: "fp16",
    approximateBytes: 219_121_675,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "MIT",
    resourceWarning: "Тяжёлый кандидат, около 219 МБ; возможен высокий расход памяти.",
  },
  {
    id: "mvanet-q4",
    label: "MVANet q4",
    modelId: "onnx-community/MVANet-ONNX",
    revision: "43ec3427514b8d9164eea02df93ca2f1b036bb7b",
    dtype: "q4",
    approximateBytes: 125_289_734,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "MIT",
    resourceWarning: "Квантованный тяжёлый кандидат, около 125 МБ.",
  },
] as const satisfies readonly EvaluationModelProfile[];

const MODEL_BY_ID = new Map<EvaluationModelId, EvaluationModelProfile>(
  EVALUATION_MODELS.map((model) => [model.id, model]),
);

export function getEvaluationModel(id: EvaluationModelId): EvaluationModelProfile {
  const model = MODEL_BY_ID.get(id);
  if (!model) throw new Error(`Unknown evaluation model: ${id}`);
  return model;
}

export function formatModelSize(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} МБ`;
}
