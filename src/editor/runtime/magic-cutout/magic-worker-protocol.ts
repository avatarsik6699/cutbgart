import type { ProcessingError } from "@/editor/domain";
import type { MagicCutoutTypes } from "@/editor/domain";
import type { GuidedModelProfile } from "@/shared/lib/inference/production-model-config";

import type { MagicCutoutRuntimeTypes } from "./magic-cutout.types";

export const MAGIC_WORKER_PROTOCOL_VERSION = 2 as const;

export type MagicPredictionStage =
  "magic-model-loading" | "magic-encode" | "magic-predict";

export type TransferableMagicSource = {
  bytes: ArrayBuffer;
  height: number;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
};

export type TransferableMagicCandidate = {
  data: ArrayBuffer;
  height: number;
  score: number;
  width: number;
};

export type MagicWorkerCommand =
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "PREDICT";
      correlation: MagicCutoutTypes.PredictionCorrelation;
      base: ArrayBuffer | null;
      model: GuidedModelProfile;
      source: TransferableMagicSource;
      strokes: readonly MagicCutoutRuntimeTypes.Stroke[];
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "CANCEL";
      correlation: MagicCutoutTypes.PredictionCorrelation;
    }
  | { protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION; type: "DISPOSE_RUNTIME" };

export type MagicWorkerEvent =
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "ACCEPTED";
      correlation: MagicCutoutTypes.PredictionCorrelation;
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "PROGRESS";
      correlation: MagicCutoutTypes.PredictionCorrelation;
      stage: MagicPredictionStage;
      fraction: number | null;
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "SUCCEEDED";
      correlation: MagicCutoutTypes.PredictionCorrelation;
      candidates: readonly TransferableMagicCandidate[];
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "FAILED";
      correlation: MagicCutoutTypes.PredictionCorrelation;
      error: ProcessingError;
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "CANCELLED";
      correlation: MagicCutoutTypes.PredictionCorrelation;
    }
  | { protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION; type: "DISPOSED" };

export function sameMagicCorrelation(
  left: MagicCutoutTypes.PredictionCorrelation,
  right: MagicCutoutTypes.PredictionCorrelation,
): boolean {
  return (
    left.documentId === right.documentId &&
    left.draftId === right.draftId &&
    left.runId === right.runId &&
    left.expectedRevision === right.expectedRevision &&
    left.draftRevision === right.draftRevision
  );
}
