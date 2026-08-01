import type {
  AlphaMatte,
  AutomaticModelMode,
  BackgroundFill,
  InferencePath,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "./types";

export type LoadModelRequest = {
  type: "load-model";
  requestId: string;
  qualityMode: QualityMode;
  inferencePath: InferencePath;
};

export type ProcessRequest = {
  type: "process";
  requestId: string;
  qualityMode: QualityMode;
  inferencePath: InferencePath;
  source: SourceImage;
};

export type ExtractAlphaMatteRequest = {
  type: "extract-alpha-matte";
  requestId: string;
  result: Blob;
};

export type RecompositeRequest = {
  type: "recomposite";
  requestId: string;
  image: ProcessedImage;
  matte: AlphaMatte;
  backgroundFill?: BackgroundFill;
};

export type DisposeRequest = { type: "dispose"; requestId: string };

export type WorkerRequest =
  | LoadModelRequest
  | ProcessRequest
  | ExtractAlphaMatteRequest
  | RecompositeRequest
  | DisposeRequest;

export type WorkerResponse =
  | {
      type: "model-progress";
      requestId: string;
      qualityMode: QualityMode;
      percent: number;
      loaded: number;
      total: number;
    }
  | { type: "log"; requestId: string; qualityMode: QualityMode; message: string }
  | {
      type: "model-ready";
      requestId: string;
      qualityMode: QualityMode;
      inferencePath: InferencePath;
      dtype: string;
    }
  | { type: "fallback-to-wasm"; requestId: string; qualityMode: QualityMode }
  | {
      type: "fallback-to-isnet";
      requestId: string;
      qualityMode: QualityMode;
      reason: "webgpu-unavailable" | "model-failed" | "device-out-of-memory";
    }
  | {
      type: "process-result";
      requestId: string;
      result: Blob;
      matte: AlphaMatte;
      durationMs: number;
      actualMode?: AutomaticModelMode;
    }
  | {
      type: "alpha-matte-result";
      requestId: string;
      matte: AlphaMatte;
      durationMs: number;
    }
  | {
      type: "recomposite-result";
      requestId: string;
      result: ProcessedImage;
      durationMs: number;
    }
  | { type: "disposed"; requestId: string }
  | {
      type: "error";
      code:
        | "model-load-failed"
        | "device-out-of-memory"
        | "processing-failed"
        | "compositing-failed";
      message: string;
      requestId?: string;
      qualityMode?: QualityMode;
    };

export type WorkerErrorResponse = Extract<WorkerResponse, { type: "error" }>;
