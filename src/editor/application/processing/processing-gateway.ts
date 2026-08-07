import type {
  DocumentSnapshot,
  ProcessingError,
  ProcessingProgress,
  ProcessingRequest,
  RunId,
} from "@/editor/domain";

export type ProcessingTerminalOutcome =
  | { type: "succeeded"; snapshot: DocumentSnapshot }
  | { type: "failed"; error: ProcessingError }
  | { type: "cancelled" };

export type ProcessingRun = {
  readonly runId: RunId;
  readonly result: Promise<DocumentSnapshot>;
  readonly terminal: Promise<ProcessingTerminalOutcome>;
  cancel(): void;
  release(): void;
  subscribe(listener: (progress: ProcessingProgress) => void): () => void;
};

export type ProcessingGateway = {
  start(request: ProcessingRequest, signal: AbortSignal): ProcessingRun;
  dispose(): Promise<void>;
};

export type ProcessingCancellation = {
  readonly signal: AbortSignal;
  abort(): void;
};

export type ProcessingCancellationSource = {
  create(): ProcessingCancellation;
};

export class ProcessingGatewayError extends Error {
  readonly detail: ProcessingError;

  constructor(detail: ProcessingError) {
    super(detail.message);
    this.name = "ProcessingGatewayError";
    this.detail = detail;
  }
}
