import type {
  AlphaMatte,
  InferencePath,
  SourceImage,
} from "../../../entities/processed-image";

export type EvaluationModelId = "isnet-q8" | "isnet-fp32" | "ben2-fp16" | "mvanet-q4";

export type MattingEvaluationModelId =
  | "vitmatte-small-composition1k-q8"
  | "vitmatte-small-composition1k-fp32"
  | "vitmatte-small-distinctions646-q8"
  | "vitmatte-small-distinctions646-fp32";

export type LightweightPromptEvaluationModelId = "efficient-sam-ti" | "mobile-sam-vit-t";

export type PromptBaselineModelId = "slimsam-q8";

export type InteractiveEvaluationModelId =
  MattingEvaluationModelId | LightweightPromptEvaluationModelId | PromptBaselineModelId;

export type CandidateEligibility =
  "production-eligible" | "evidence-only" | "rejected-license";

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

export interface InteractiveEvaluationModelProfile {
  id: InteractiveEvaluationModelId;
  label: string;
  family: "matting" | "promptable";
  modelId: string;
  revision: string;
  graphFiles: readonly string[];
  dtype: EvaluationDtype;
  license: string;
  eligibility: CandidateEligibility;
  supportedPaths: readonly InferencePath[];
  approximateBytes: number;
  resourceWarning: string;
  unsupportedReason?: string;
}

export type MattingCorpusCategory =
  | "hair-fur"
  | "transparent-thin"
  | "holes"
  | "shadows"
  | "light-on-light"
  | "multiple-objects"
  | "motion-blur"
  | "high-resolution-small-target";

export interface MattingCorpusCase {
  ordinal: number;
  category: MattingCorpusCategory;
  source: SourceImage;
  trimap: AlphaMatte;
  groundTruth: AlphaMatte;
  sourceUrl: string;
}

export interface MattingQualityMeasurement {
  caseOrdinal: number;
  modelId: InteractiveEvaluationModelId;
  iou: number | null;
  boundaryIou: number | null;
  sad: number | null;
  mse: number | null;
  gradient: number | null;
  connectivity: number | null;
  interactionsToAccept: number | null;
}

export type InteractiveEvaluationErrorCode =
  | "license-rejected"
  | "operator-unsupported"
  | "model-load-failed"
  | "device-out-of-memory"
  | "processing-failed";

export interface InteractiveRuntimeMeasurement {
  caseOrdinal: number;
  modelId: InteractiveEvaluationModelId;
  requestedPath: InferencePath;
  actualPath: InferencePath;
  status: "success" | "unsupported" | "error";
  coldLoadMs: number;
  warmInferenceMs: number;
  peakMemoryBytes: number | null;
  memoryObservation: "measured" | "estimated" | "unavailable";
  fallbackReason?: string;
  errorCode?: InteractiveEvaluationErrorCode;
}

export interface InteractiveMattingBenchmarkExport {
  schemaVersion: 2;
  createdAt: string;
  capabilities: ModelLabCapabilities;
  candidates: InteractiveEvaluationModelProfile[];
  corpusCaseCount: number;
  quality: MattingQualityMeasurement[];
  runtime: InteractiveRuntimeMeasurement[];
  decision: InteractiveEvaluationModelId | "none";
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

export interface ModelLabInteractiveProcessRequest {
  type: "process-interactive";
  requestId: string;
  modelId: InteractiveEvaluationModelId;
  inferencePath: InferencePath;
  source: SourceImage;
  trimap: AlphaMatte;
  caseOrdinal: number;
}

export type ModelLabWorkerRequest =
  ModelLabProcessRequest | ModelLabInteractiveProcessRequest | ModelLabCancelRequest;

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

export interface ModelLabInteractiveProgressResponse {
  type: "interactive-progress";
  requestId: string;
  modelId: InteractiveEvaluationModelId;
  stage: "loading" | "processing";
  percent: number | null;
}

export interface ModelLabInteractiveResultResponse {
  type: "interactive-result";
  requestId: string;
  modelId: InteractiveEvaluationModelId;
  caseOrdinal: number;
  result: Blob;
  matte: AlphaMatte;
  measurement: InteractiveRuntimeMeasurement;
}

export interface ModelLabInteractiveErrorResponse {
  type: "interactive-error";
  requestId: string;
  modelId: InteractiveEvaluationModelId;
  caseOrdinal: number;
  code: InteractiveEvaluationErrorCode;
  message: string;
  measurement: InteractiveRuntimeMeasurement;
}

export type ModelLabWorkerResponse =
  ModelLabProgressResponse | ModelLabResultResponse | ModelLabErrorResponse;

export type ModelLabAnyWorkerResponse =
  | ModelLabWorkerResponse
  | ModelLabInteractiveProgressResponse
  | ModelLabInteractiveResultResponse
  | ModelLabInteractiveErrorResponse;

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
