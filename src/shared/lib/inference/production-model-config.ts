export type AutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";
export type AutomaticQualityMode = "fast" | "max" | AutomaticModelMode;
export type BrowserInferencePath = "webgpu" | "wasm";

export type ProductionModelProfile = {
  approximateBytes: number;
  dtype: "q8" | "fp32" | "fp16";
  id: AutomaticModelMode;
  modelId: "onnx-community/ISNet-ONNX" | "onnx-community/BEN2-ONNX";
  relativeSpeed: "fast" | "balanced" | "slow";
  requiresWebGPU: boolean;
  revision: string;
  supportedPaths: readonly BrowserInferencePath[];
};

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

export function normalizeModelMode(mode: AutomaticQualityMode): AutomaticModelMode {
  return mode === "fast" ? "isnet-q8" : mode === "max" ? "isnet-fp32" : mode;
}

export function getProductionModel(mode: AutomaticQualityMode): ProductionModelProfile {
  const normalized = normalizeModelMode(mode);
  const profile = PRODUCTION_MODELS.find((candidate) => candidate.id === normalized);
  if (profile === undefined) {
    throw new Error(`Unknown production model mode: ${mode}`);
  }
  return profile;
}
