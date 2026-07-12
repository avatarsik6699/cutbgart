import type {
  AlphaMatte,
  InferencePath,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";

export type BatchItemStatus =
  "queued" | "model-loading" | "processing" | "result" | "error";
export type ProcessingStage =
  "queued" | "preparing" | "inference" | "compositing" | "complete";

export interface ModelLoadProgress {
  status: "idle" | "checking-cache" | "downloading" | "building-session" | "ready";
  percent: number | null;
  loadedBytes: number;
  totalBytes: number | null;
  fromCache: boolean | null;
}

export interface ItemProcessingProgress {
  stage: ProcessingStage;
  startedAt: number | null;
  elapsedMs: number;
  percent: null;
}

export interface BatchItem {
  id: string;
  originalFileName: string;
  source: SourceImage;
  qualityMode: QualityMode;
  alphaMatte?: AlphaMatte;
  processedImage?: ProcessedImage;
  status: BatchItemStatus;
  error?: string;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  processingProgress: ItemProcessingProgress;
}

export interface BatchSession {
  items: BatchItem[];
  selectedItemId: string | null;
  modelLoads: Partial<Record<`${QualityMode}:${InferencePath}`, ModelLoadProgress>>;
}

export interface BatchSchedulerSnapshot {
  inferencePath: InferencePath;
  concurrencyLimit: 1 | 2;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
}

export function deriveBatchSchedulerSnapshot(
  session: BatchSession,
  inferencePath: InferencePath,
  concurrencyLimit: 1 | 2,
): BatchSchedulerSnapshot {
  return {
    inferencePath,
    concurrencyLimit,
    activeCount: session.items.filter(
      (item) => item.status === "model-loading" || item.status === "processing",
    ).length,
    queuedCount: session.items.filter((item) => item.status === "queued").length,
    completedCount: session.items.filter((item) => item.status === "result").length,
    failedCount: session.items.filter((item) => item.status === "error").length,
    totalCount: session.items.length,
  };
}
