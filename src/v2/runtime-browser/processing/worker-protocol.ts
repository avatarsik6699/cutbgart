import type {
  ArtifactMediaType,
  ProcessingError,
  ProcessingStage,
  RunCorrelation,
} from "@/v2/domain";
import type { AutomaticModelMode, BrowserInferencePath } from "@/shared/lib";

import type { LocalModelConfig } from "./model-config";

export const PROCESSING_WORKER_PROTOCOL_VERSION = 1 as const;

export type StageTiming = {
  durationMs: number;
  stage: ProcessingStage;
};

export type TransferableSourceArtifact = {
  bytes: ArrayBuffer;
  height: number;
  mediaType: Extract<ArtifactMediaType, "image/jpeg" | "image/png" | "image/webp">;
  width: number;
};

export type TransferableArtifactSet = {
  compositePng: ArrayBuffer;
  height: number;
  matte: ArrayBuffer;
  width: number;
};

export type ProcessingWorkerCommand =
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "RUN";
      correlation: RunCorrelation;
      model: LocalModelConfig;
      source: TransferableSourceArtifact;
    }
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "CANCEL";
      correlation: RunCorrelation;
    }
  | { protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION; type: "DISPOSE_RUNTIME" };

export type ProcessingWorkerEvent =
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "ACCEPTED";
      correlation: RunCorrelation;
    }
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "EXECUTION_SELECTED";
      correlation: RunCorrelation;
      inferencePath: BrowserInferencePath;
      modelMode: AutomaticModelMode;
    }
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "PROGRESS";
      correlation: RunCorrelation;
      fraction: number | null;
      stage: ProcessingStage;
      timing: StageTiming | null;
    }
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "CANCELLED";
      correlation: RunCorrelation;
      timings: readonly StageTiming[];
    }
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "SUCCEEDED";
      correlation: RunCorrelation;
      outputs: TransferableArtifactSet;
      timings: readonly StageTiming[];
    }
  | {
      protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION;
      type: "FAILED";
      correlation: RunCorrelation;
      error: ProcessingError;
      timings: readonly StageTiming[];
    }
  | { protocol: typeof PROCESSING_WORKER_PROTOCOL_VERSION; type: "DISPOSED" };

export function sameCorrelation(left: RunCorrelation, right: RunCorrelation): boolean {
  return (
    left.documentId === right.documentId &&
    left.runId === right.runId &&
    left.expectedRevision === right.expectedRevision
  );
}
