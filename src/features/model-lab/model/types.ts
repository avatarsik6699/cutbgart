import type {
  AlphaMatte,
  InferencePath,
  SourceImage,
} from "../../../entities/processed-image";

export type EvaluationModelId = "isnet-q8" | "isnet-fp32" | "ben2-fp16" | "mvanet-q4";

export type EvaluationDtype = "q8" | "fp32" | "fp16" | "q4";
export type EvaluationStatus = "queued" | "loading" | "processing" | "success" | "error";

export interface EvaluationModelProfile {
  id: EvaluationModelId;
  label: string;
  modelId: string;
  revision: string;
  dtype: EvaluationDtype;
  approximateBytes: number;
  supportedPaths: readonly InferencePath[];
  license: "AGPL-3.0" | "MIT";
  resourceWarning: string;
}

export type EvaluationErrorCode =
  "model-load-failed" | "device-out-of-memory" | "processing-failed";

export interface BenchmarkMeasurement {
  imageOrdinal: number;
  modelId: EvaluationModelId;
  requestedPath: InferencePath;
  actualPath: InferencePath;
  status: "success" | "error";
  loadMs: number;
  inferenceMs: number;
  fallbackReason?: string;
  errorCode?: EvaluationErrorCode;
}

export interface BenchmarkPreference {
  imageOrdinal: number;
  preferredModelId: EvaluationModelId | "tie" | "neither";
}

export interface LabImage {
  id: string;
  ordinal: number;
  source: SourceImage;
  sourceUrl: string;
}

export interface LabResult {
  imageOrdinal: number;
  modelId: EvaluationModelId;
  result: Blob;
  resultUrl: string;
  measurement: BenchmarkMeasurement;
}

export interface ModelLabState {
  status: "idle" | "ready" | "running" | "complete" | "cancelled";
  images: LabImage[];
  selectedModelIds: EvaluationModelId[];
  results: LabResult[];
  measurements: BenchmarkMeasurement[];
  preferences: BenchmarkPreference[];
  current?: {
    imageOrdinal: number;
    modelId: EvaluationModelId;
    stage: "loading" | "processing";
    percent: number | null;
  };
  progress: { completed: number; total: number };
  error?: string;
}

export interface ModelLabCapabilities {
  requestedPath: InferencePath;
  userAgent: string;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  crossOriginIsolated: boolean;
}

export interface ModelLabProcessRequest {
  type: "process";
  requestId: string;
  modelId: EvaluationModelId;
  inferencePath: InferencePath;
  source: SourceImage;
  imageOrdinal: number;
}

export interface ModelLabCancelRequest {
  type: "cancel";
}

export type ModelLabWorkerRequest = ModelLabProcessRequest | ModelLabCancelRequest;

export interface ModelLabProgressResponse {
  type: "progress";
  requestId: string;
  modelId: EvaluationModelId;
  stage: "loading" | "processing";
  percent: number | null;
}

export interface ModelLabResultResponse {
  type: "result";
  requestId: string;
  modelId: EvaluationModelId;
  imageOrdinal: number;
  result: Blob;
  matte: AlphaMatte;
  measurement: BenchmarkMeasurement;
}

export interface ModelLabErrorResponse {
  type: "error";
  requestId: string;
  modelId: EvaluationModelId;
  imageOrdinal: number;
  code: EvaluationErrorCode;
  message: string;
  measurement: BenchmarkMeasurement;
}

export type ModelLabWorkerResponse =
  ModelLabProgressResponse | ModelLabResultResponse | ModelLabErrorResponse;

export interface BenchmarkExport {
  schemaVersion: 1;
  createdAt: string;
  capabilities: ModelLabCapabilities;
  models: Array<{
    id: EvaluationModelId;
    revision: string;
    dtype: EvaluationDtype;
  }>;
  imageCount: number;
  measurements: BenchmarkMeasurement[];
  preferences: BenchmarkPreference[];
}
