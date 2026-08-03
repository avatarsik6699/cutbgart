import type { QualityMode } from "../../../entities/processed-image";

export {
  getProductionModel,
  normalizeModelMode,
  PRODUCTION_MODELS,
} from "../../../shared/lib";
export type { ProductionModelProfile } from "../../../shared/lib";

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
