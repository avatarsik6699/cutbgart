import type { ProcessingError } from "@/v2/domain";
import type { MagicPredictionCorrelation } from "@/v2/domain";
import type { GuidedModelProfile } from "@/shared/lib/inference/production-model-config";

import type { MagicStroke } from "./magic-cutout.types";

export const MAGIC_WORKER_PROTOCOL_VERSION = 1 as const;

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
      correlation: MagicPredictionCorrelation;
      model: GuidedModelProfile;
      source: TransferableMagicSource;
      strokes: readonly MagicStroke[];
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "CANCEL";
      correlation: MagicPredictionCorrelation;
    }
  | { protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION; type: "DISPOSE_RUNTIME" };

export type MagicWorkerEvent =
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "ACCEPTED";
      correlation: MagicPredictionCorrelation;
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "PROGRESS";
      correlation: MagicPredictionCorrelation;
      stage: MagicPredictionStage;
      fraction: number | null;
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "SUCCEEDED";
      correlation: MagicPredictionCorrelation;
      candidates: readonly TransferableMagicCandidate[];
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "FAILED";
      correlation: MagicPredictionCorrelation;
      error: ProcessingError;
    }
  | {
      protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION;
      type: "CANCELLED";
      correlation: MagicPredictionCorrelation;
    }
  | { protocol: typeof MAGIC_WORKER_PROTOCOL_VERSION; type: "DISPOSED" };

export function sameMagicCorrelation(
  left: MagicPredictionCorrelation,
  right: MagicPredictionCorrelation,
): boolean {
  return (
    left.documentId === right.documentId &&
    left.draftId === right.draftId &&
    left.runId === right.runId &&
    left.expectedRevision === right.expectedRevision &&
    left.draftRevision === right.draftRevision
  );
}
