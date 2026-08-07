import type {
  DocumentId,
  EnhancementDraftId,
  EnhancementTypes,
  LocalInferencePath,
  Revision,
  RunId,
} from "@/editor/domain";
import { isProcessingErrorCode } from "@/editor/domain";
import type { ProcessingError } from "@/editor/domain";

export const ENHANCEMENT_WORKER_PROTOCOL_VERSION = 1 as const;

export type EnhancementRunCorrelation = {
  documentId: DocumentId;
  draftId: EnhancementDraftId;
  runId: RunId;
  expectedRevision: Revision;
  operationId: EnhancementTypes.OperationId;
};

export type EnhancementWorkerStage =
  "enhancement-model-loading" | "enhancement-fine-detail" | "enhancement-colour-halo";

export type EnhancementWorkerImage = {
  bytes: ArrayBuffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

type EnhancementWorkerBaseRun = {
  protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
  type: "RUN";
  correlation: EnhancementRunCorrelation;
  source: EnhancementWorkerImage;
  matte: ArrayBuffer;
  width: number;
  height: number;
};

export type EnhancementWorkerCommand =
  | (EnhancementWorkerBaseRun & {
      correlation: EnhancementRunCorrelation & { operationId: "fine-detail" };
      requestedMode: "balanced" | "maximum";
      requestedPath: LocalInferencePath;
    })
  | (EnhancementWorkerBaseRun & {
      correlation: EnhancementRunCorrelation & { operationId: "colour-halo" };
    })
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "CANCEL";
      correlation: EnhancementRunCorrelation;
    }
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "DISPOSE_RUNTIME";
    };

export type EnhancementWorkerSuccess =
  | {
      operationId: "fine-detail";
      matte: ArrayBuffer;
      changed: boolean;
      actualMode: "balanced" | "maximum" | "deterministic";
      actualPath: LocalInferencePath | null;
      fallback: "none" | "balanced" | "wasm" | "deterministic";
    }
  | {
      operationId: "colour-halo";
      matte: ArrayBuffer;
      foregroundPng: ArrayBuffer | null;
      changed: boolean;
      actualPath: "decontaminate" | "edge-aware-fallback" | "unchanged";
      fallback: "none" | "no-soft-edge" | "no-background-samples";
    };

export type EnhancementWorkerEvent =
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "ACCEPTED";
      correlation: EnhancementRunCorrelation;
    }
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "PROGRESS";
      correlation: EnhancementRunCorrelation;
      stage: EnhancementWorkerStage;
      fraction: number | null;
    }
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "SUCCEEDED";
      correlation: EnhancementRunCorrelation;
      output: EnhancementWorkerSuccess;
    }
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "FAILED";
      correlation: EnhancementRunCorrelation;
      error: ProcessingError;
    }
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "CANCELLED";
      correlation: EnhancementRunCorrelation;
    }
  | {
      protocol: typeof ENHANCEMENT_WORKER_PROTOCOL_VERSION;
      type: "DISPOSED";
    };

export function sameEnhancementCorrelation(
  left: EnhancementRunCorrelation,
  right: EnhancementRunCorrelation,
): boolean {
  return (
    left.documentId === right.documentId &&
    left.draftId === right.draftId &&
    left.runId === right.runId &&
    left.expectedRevision === right.expectedRevision &&
    left.operationId === right.operationId
  );
}

export function isEnhancementWorkerEvent(
  value: unknown,
): value is EnhancementWorkerEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  if (event.protocol !== ENHANCEMENT_WORKER_PROTOCOL_VERSION) return false;
  if (event.type === "DISPOSED") return true;
  if (
    event.type !== "ACCEPTED" &&
    event.type !== "PROGRESS" &&
    event.type !== "SUCCEEDED" &&
    event.type !== "FAILED" &&
    event.type !== "CANCELLED"
  ) {
    return false;
  }
  if (typeof event.correlation !== "object" || event.correlation === null) return false;
  const correlation = event.correlation as Record<string, unknown>;
  const validCorrelation =
    typeof correlation.documentId === "string" &&
    typeof correlation.draftId === "string" &&
    typeof correlation.runId === "string" &&
    Number.isSafeInteger(correlation.expectedRevision) &&
    (correlation.operationId === "fine-detail" ||
      correlation.operationId === "colour-halo");
  if (!validCorrelation) return false;
  if (event.type === "ACCEPTED" || event.type === "CANCELLED") return true;
  if (event.type === "PROGRESS") {
    return (
      (event.stage === "enhancement-model-loading" ||
        event.stage === "enhancement-fine-detail" ||
        event.stage === "enhancement-colour-halo") &&
      (event.fraction === null ||
        (typeof event.fraction === "number" &&
          Number.isFinite(event.fraction) &&
          event.fraction >= 0 &&
          event.fraction <= 1))
    );
  }
  if (event.type === "FAILED") {
    if (typeof event.error !== "object" || event.error === null) return false;
    const error = event.error as Record<string, unknown>;
    return (
      isProcessingErrorCode(error.code) &&
      typeof error.message === "string" &&
      typeof error.retryable === "boolean"
    );
  }
  if (typeof event.output !== "object" || event.output === null) return false;
  const output = event.output as Record<string, unknown>;
  if (
    output.operationId !== correlation.operationId ||
    !(output.matte instanceof ArrayBuffer) ||
    typeof output.changed !== "boolean"
  ) {
    return false;
  }
  return output.operationId === "fine-detail"
    ? (output.actualMode === "balanced" ||
        output.actualMode === "maximum" ||
        output.actualMode === "deterministic") &&
        (output.actualPath === null ||
          output.actualPath === "webgpu" ||
          output.actualPath === "wasm") &&
        (output.fallback === "none" ||
          output.fallback === "balanced" ||
          output.fallback === "wasm" ||
          output.fallback === "deterministic")
    : (output.foregroundPng === null || output.foregroundPng instanceof ArrayBuffer) &&
        (output.actualPath === "decontaminate" ||
          output.actualPath === "edge-aware-fallback" ||
          output.actualPath === "unchanged") &&
        (output.fallback === "none" ||
          output.fallback === "no-soft-edge" ||
          output.fallback === "no-background-samples");
}
