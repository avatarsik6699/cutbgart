import type { ArtifactId, DocumentId, Revision, RunId } from "./ids";
import type { DocumentSnapshot } from "./artifacts";

export type ProcessingBackend = "local" | "remote";

export type ProcessingStage =
  | "queued"
  | "model-loading"
  | "decode"
  | "automatic-remove"
  | "post-process"
  | "composite"
  | "encode-png";

export type RunCorrelation = {
  documentId: DocumentId;
  runId: RunId;
  expectedRevision: Revision;
};

export type ProcessingRequest = RunCorrelation & {
  operation: "automatic-remove";
  source: ArtifactId;
};

export type ProcessingProgress = RunCorrelation & {
  stage: ProcessingStage;
  fraction: number | null;
};

export type ProcessingErrorCode =
  | "aborted"
  | "artifact-unavailable"
  | "decode-failed"
  | "invalid-request"
  | "model-load-failed"
  | "processing-failed"
  | "worker-crashed"
  | "worker-protocol-error";

export type ProcessingError = {
  code: ProcessingErrorCode;
  message: string;
  retryable: boolean;
};

export type ProcessingTerminalEvent =
  | (RunCorrelation & { type: "PROCESSING_SUCCEEDED"; snapshot: DocumentSnapshot })
  | (RunCorrelation & { type: "PROCESSING_FAILED"; error: ProcessingError })
  | (RunCorrelation & { type: "PROCESSING_CANCELLED" });

export function isProcessingTerminalEvent(value: {
  type: string;
}): value is ProcessingTerminalEvent {
  return (
    value.type === "PROCESSING_SUCCEEDED" ||
    value.type === "PROCESSING_FAILED" ||
    value.type === "PROCESSING_CANCELLED"
  );
}
