import type { InferencePath } from "../../../entities/processed-image";
import type {
  MattingModelProfile,
  MattingModelVariantId,
  MattingRefinementMode,
} from "./types";

const REVISION = "358d428c452e5e0cd52955011a8b51944731d28e" as const;
const MODEL_ID = "Xenova/vitmatte-small-distinctions-646" as const;
const SUPPORTED_PATHS = ["webgpu", "wasm"] as const;

export const MATTING_MODELS = [
  {
    id: "vitmatte-small-distinctions646-q8",
    mode: "balanced",
    modelId: MODEL_ID,
    revision: REVISION,
    graphFile: "onnx/model_quantized.onnx",
    dtype: "q8",
    approximateBytes: 27_499_369,
    supportedPaths: SUPPORTED_PATHS,
    license: "Apache-2.0",
  },
  {
    id: "vitmatte-small-distinctions646-fp32",
    mode: "maximum",
    modelId: MODEL_ID,
    revision: REVISION,
    graphFile: "onnx/model.onnx",
    dtype: "fp32",
    approximateBytes: 103_885_865,
    supportedPaths: SUPPORTED_PATHS,
    license: "Apache-2.0",
  },
] as const satisfies readonly MattingModelProfile[];

export function getMattingModel(
  modeOrId: MattingRefinementMode | MattingModelVariantId,
): MattingModelProfile {
  const profile = MATTING_MODELS.find(
    (candidate) => candidate.mode === modeOrId || candidate.id === modeOrId,
  );
  if (!profile) throw new Error(`Unknown matting model: ${modeOrId}`);
  return profile;
}

export function recommendMattingMode(path: InferencePath | null): MattingRefinementMode {
  return path === "webgpu" ? "maximum" : "balanced";
}

export function formatMattingModelSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(bytes < 50_000_000 ? 1 : 0)} MB`;
}
