export type AutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";
export type AutomaticQualityMode = "fast" | "max" | AutomaticModelMode;
export type BrowserInferencePath = "webgpu" | "wasm";
export type MattingRefinementMode = "balanced" | "maximum";
export type MattingModelVariantId =
  "vitmatte-small-distinctions646-q8" | "vitmatte-small-distinctions646-fp32";

export type MattingModelProfile = {
  id: MattingModelVariantId;
  mode: MattingRefinementMode;
  modelId: "Xenova/vitmatte-small-distinctions-646";
  revision: "358d428c452e5e0cd52955011a8b51944731d28e";
  graphFile: "onnx/model_quantized.onnx" | "onnx/model.onnx";
  dtype: "q8" | "fp32";
  approximateBytes: 27_499_369 | 103_885_865;
  supportedPaths: readonly ["webgpu", "wasm"];
  license: "Apache-2.0";
};

export const MATTING_MODELS = Object.freeze([
  Object.freeze({
    id: "vitmatte-small-distinctions646-q8",
    mode: "balanced",
    modelId: "Xenova/vitmatte-small-distinctions-646",
    revision: "358d428c452e5e0cd52955011a8b51944731d28e",
    graphFile: "onnx/model_quantized.onnx",
    dtype: "q8",
    approximateBytes: 27_499_369,
    supportedPaths: ["webgpu", "wasm"] as const,
    license: "Apache-2.0",
  }),
  Object.freeze({
    id: "vitmatte-small-distinctions646-fp32",
    mode: "maximum",
    modelId: "Xenova/vitmatte-small-distinctions-646",
    revision: "358d428c452e5e0cd52955011a8b51944731d28e",
    graphFile: "onnx/model.onnx",
    dtype: "fp32",
    approximateBytes: 103_885_865,
    supportedPaths: ["webgpu", "wasm"] as const,
    license: "Apache-2.0",
  }),
] as const satisfies readonly MattingModelProfile[]);

export function getMattingModel(
  modeOrId: MattingRefinementMode | MattingModelVariantId,
): MattingModelProfile {
  const profile = MATTING_MODELS.find(
    (candidate) => candidate.mode === modeOrId || candidate.id === modeOrId,
  );
  if (profile === undefined) throw new Error(`Unknown matting model: ${modeOrId}`);
  return profile;
}

export type GuidedModelProfile = {
  approximateBytes: 13_840_000;
  dtype: "q8";
  license: "Apache-2.0";
  modelId: "Xenova/slimsam-77-uniform";
  revision: "7c8459c48dabad6291b384c97be46c451c25d6c4";
  supportedPaths: readonly ["wasm"];
};

export const GUIDED_MODEL: GuidedModelProfile = {
  modelId: "Xenova/slimsam-77-uniform",
  revision: "7c8459c48dabad6291b384c97be46c451c25d6c4",
  dtype: "q8",
  approximateBytes: 13_840_000,
  supportedPaths: ["wasm"],
  license: "Apache-2.0",
};

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
