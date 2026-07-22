import type {
  AlphaMatte,
  InferencePath,
  PixelRect,
  RefinementConstraintMap,
  SourceImage,
  Trimap,
} from "../../../entities/processed-image";

export type MattingRefinementMode = "balanced" | "maximum";
export type MattingModelVariantId =
  "vitmatte-small-distinctions646-q8" | "vitmatte-small-distinctions646-fp32";

export interface MattingModelProfile {
  id: MattingModelVariantId;
  mode: MattingRefinementMode;
  modelId: "Xenova/vitmatte-small-distinctions-646";
  revision: "358d428c452e5e0cd52955011a8b51944731d28e";
  graphFile: "onnx/model_quantized.onnx" | "onnx/model.onnx";
  dtype: "q8" | "fp32";
  approximateBytes: 27_499_369 | 103_885_865;
  supportedPaths: readonly ["webgpu", "wasm"];
  license: "Apache-2.0";
}

export type MattingRefinementStatus =
  | "idle"
  | "preparing"
  | "loading-model"
  | "refining"
  | "applying"
  | "fallback"
  | "result"
  | "error";

export interface MatteRefinementRequest {
  requestId: string;
  source: SourceImage;
  priorMatte: AlphaMatte;
  guidedMatte: AlphaMatte | null;
  constraints: RefinementConstraintMap | null;
  trimap: Trimap;
  crop: PixelRect;
  inputSize: MattingInputSize;
  requestedMode: MattingRefinementMode;
  requestedPath: InferencePath;
}

export interface MattingInputSize {
  width: number;
  height: number;
}

export type MattingFallback = "none" | "balanced" | "wasm" | "deterministic";

export interface MattingRefinementResult {
  matte: AlphaMatte;
  requestedMode: MattingRefinementMode;
  actualMode: MattingRefinementMode | "deterministic";
  actualPath: InferencePath | null;
  inputSize: MattingInputSize;
  fallback: MattingFallback;
  fallbackReason?: string;
}

export type MattingRefinementErrorCode =
  | "invalid-input"
  | "model-load-failed"
  | "operator-unsupported"
  | "webgpu-failed"
  | "device-out-of-memory"
  | "processing-failed"
  | "cancelled";

export interface MattingRefinementError {
  code: MattingRefinementErrorCode;
  message: string;
  recoverable: boolean;
}

export type MatteRefinementWorkerRequest =
  | { type: "refine"; request: MatteRefinementRequest }
  | { type: "cancel"; requestId: string }
  | { type: "dispose"; requestId: string };

export type MatteRefinementWorkerResponse =
  | {
      type: "progress";
      requestId: string;
      stage: "loading" | "refining";
      percent: number | null;
    }
  | {
      type: "fallback";
      requestId: string;
      from: MattingRefinementMode;
      to: MattingRefinementMode;
      fromPath: InferencePath;
      toPath: InferencePath;
      reason: string;
    }
  | { type: "result"; requestId: string; result: MattingRefinementResult }
  | { type: "error"; requestId: string; error: MattingRefinementError }
  | { type: "disposed"; requestId: string };
