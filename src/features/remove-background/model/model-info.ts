import type { QualityMode } from "../../../entities/processed-image";

// Single source of truth for which model/dtype backs each quality tier —
// imported by both the worker (to actually load the model) and the UI (to
// tell the user what's running). See `worker/inference.worker.ts` for the
// full rationale behind this model choice.
export const MODEL_ID = "onnx-community/ISNet-ONNX";
export const MODEL_REVISION = "3fe6e3db3e32c69aadde61fe388ddb1a0574440c";

export const DTYPES: Record<QualityMode, "q8" | "fp32"> = {
  fast: "q8",
  max: "fp32",
};
