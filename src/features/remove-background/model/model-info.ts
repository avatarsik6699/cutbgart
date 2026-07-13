import type {
  AutomaticModelMode,
  InferencePath,
  QualityMode,
} from "../../../entities/processed-image";

// Single source of truth for which model/dtype backs each quality tier —
// imported by both the worker (to actually load the model) and the UI (to
// tell the user what's running). See `worker/inference.worker.ts` for the
// full rationale behind this model choice.
export interface ProductionModelProfile {
  id: AutomaticModelMode;
  modelId: "onnx-community/ISNet-ONNX" | "onnx-community/BEN2-ONNX";
  revision: string;
  dtype: "q8" | "fp32" | "fp16";
  approximateBytes: number;
  supportedPaths: readonly InferencePath[];
  relativeSpeed: "fast" | "balanced" | "slow";
  requiresWebGPU: boolean;
}

export const PRODUCTION_MODELS = [
  {
    id: "isnet-q8",
    modelId: "onnx-community/ISNet-ONNX",
    revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
    dtype: "q8",
    approximateBytes: 44_348_381,
    supportedPaths: ["webgpu", "wasm"],
    relativeSpeed: "fast",
    requiresWebGPU: false,
  },
  {
    id: "isnet-fp32",
    modelId: "onnx-community/ISNet-ONNX",
    revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
    dtype: "fp32",
    approximateBytes: 176_114_856,
    supportedPaths: ["webgpu", "wasm"],
    relativeSpeed: "balanced",
    requiresWebGPU: false,
  },
  {
    id: "ben2-fp16",
    modelId: "onnx-community/BEN2-ONNX",
    revision: "c552aa82688edce09f0ac9d2e31ad53d9d629010",
    dtype: "fp16",
    approximateBytes: 219_121_675,
    supportedPaths: ["webgpu"],
    relativeSpeed: "slow",
    requiresWebGPU: true,
  },
] as const satisfies readonly ProductionModelProfile[];

export function normalizeModelMode(mode: QualityMode): AutomaticModelMode {
  return mode === "fast" ? "isnet-q8" : mode === "max" ? "isnet-fp32" : mode;
}

export function getProductionModel(mode: QualityMode): ProductionModelProfile {
  const normalized = normalizeModelMode(mode);
  const profile = PRODUCTION_MODELS.find((candidate) => candidate.id === normalized);
  if (!profile) throw new Error(`Unknown production model mode: ${mode}`);
  return profile;
}

export const MODEL_ID = "onnx-community/ISNet-ONNX";
export const MODEL_REVISION = "3fe6e3db3e32c69aadde61fe388ddb1a0574440c";

export const DTYPES: Record<QualityMode, "q8" | "fp32"> = {
  fast: "q8",
  max: "fp32",
  "isnet-q8": "q8",
  "isnet-fp32": "fp32",
  // Kept only for legacy imports; production worker resolves the profile.
  "ben2-fp16": "fp32",
};
