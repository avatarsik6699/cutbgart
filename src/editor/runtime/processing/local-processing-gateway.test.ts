import { describe, expect, it, vi } from "vitest";

import { ProcessingGatewayError } from "@/editor/application";
import {
  createArtifactId,
  createDocumentId,
  createRunId,
  type DocumentSnapshot,
  type ProcessingProgress,
  type ProcessingRequest,
} from "@/editor/domain";

import {
  LocalProcessingGateway,
  type LocalProcessingExecutor,
} from "./local-processing-gateway";

const request: ProcessingRequest = {
  documentId: createDocumentId("document-1"),
  runId: createRunId("run-1"),
  expectedRevision: 0,
  operation: "automatic-remove",
  source: createArtifactId("source-1"),
  modelMode: "isnet-q8",
};
const snapshot: DocumentSnapshot = {
  matte: createArtifactId("matte-1"),
  foreground: null,
  composite: createArtifactId("composite-1"),
  background: { type: "transparent" },
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function createExecutor(run: Deferred<DocumentSnapshot>) {
  let publish: ((progress: ProcessingProgress) => void) | null = null;
  let receivedSignal: AbortSignal | null = null;
  const dispose = vi.fn(() => Promise.resolve());
  const executor: LocalProcessingExecutor = {
    execute(_request, signal, nextProgress) {
      receivedSignal = signal;
      publish = nextProgress;
      return run.promise;
    },
    dispose,
  };
  return {
    dispose,
    executor,
    publish(progress: ProcessingProgress) {
      publish?.(progress);
    },
    signal() {
      return receivedSignal;
    },
  };
}

describe("LocalProcessingGateway", () => {
  it("publishes matching progress and resolves one successful terminal result", async () => {
    const execution = deferred<DocumentSnapshot>();
    const harness = createExecutor(execution);
    const gateway = new LocalProcessingGateway(harness.executor);
    const run = gateway.start(request, new AbortController().signal);
    const listener = vi.fn();
    run.subscribe(listener);

    harness.publish({ ...request, stage: "model-loading", fraction: 0.25 });
    harness.publish({
      ...request,
      runId: createRunId("foreign"),
      stage: "decode",
      fraction: 0.5,
    });
    execution.resolve(snapshot);

    await expect(run.result).resolves.toBe(snapshot);
    await expect(run.terminal).resolves.toEqual({ type: "succeeded", snapshot });
    expect(listener).toHaveBeenCalledOnce();
    run.release();
    await gateway.dispose();
  });

  it("cancels immediately, aborts the executor, and ignores a late success", async () => {
    const execution = deferred<DocumentSnapshot>();
    const harness = createExecutor(execution);
    const gateway = new LocalProcessingGateway(harness.executor);
    const run = gateway.start(request, new AbortController().signal);

    run.cancel();
    expect(harness.signal()?.aborted).toBe(true);
    const resultError: unknown = await run.result.catch((error: unknown) => error);
    expect(resultError).toBeInstanceOf(ProcessingGatewayError);
    if (resultError instanceof ProcessingGatewayError) {
      expect(resultError.detail.code).toBe("aborted");
    }
    await expect(run.terminal).resolves.toEqual({ type: "cancelled" });

    execution.resolve(snapshot);
    await Promise.resolve();
    await gateway.dispose();
  });

  it("links external abort and release idempotently", async () => {
    const execution = deferred<DocumentSnapshot>();
    const harness = createExecutor(execution);
    const gateway = new LocalProcessingGateway(harness.executor);
    const external = new AbortController();
    const run = gateway.start(request, external.signal);
    const listener = vi.fn();
    run.subscribe(listener);

    external.abort();
    await expect(run.terminal).resolves.toEqual({ type: "cancelled" });
    run.release();
    run.release();
    harness.publish({ ...request, stage: "decode", fraction: 0.5 });
    expect(listener).not.toHaveBeenCalled();
    await gateway.dispose();
  });

  it("normalizes executor failures into a terminal error", async () => {
    const execution = deferred<DocumentSnapshot>();
    const harness = createExecutor(execution);
    const gateway = new LocalProcessingGateway(harness.executor);
    const run = gateway.start(request, new AbortController().signal);

    execution.reject(new Error("GPU unavailable"));
    await expect(run.terminal).resolves.toEqual({
      type: "failed",
      error: { code: "processing-failed", message: "GPU unavailable", retryable: true },
    });
    run.release();
    await gateway.dispose();
  });

  it("normalizes a synchronous executor failure into the same terminal contract", async () => {
    const executor: LocalProcessingExecutor = {
      execute() {
        throw new Error("Worker creation failed");
      },
      dispose() {
        return Promise.resolve();
      },
    };
    const gateway = new LocalProcessingGateway(executor);
    const run = gateway.start(request, new AbortController().signal);

    await expect(run.terminal).resolves.toEqual({
      type: "failed",
      error: {
        code: "processing-failed",
        message: "Worker creation failed",
        retryable: true,
      },
    });
    run.release();
    await gateway.dispose();
  });

  it("cancels all active work on dispose and rejects new starts", async () => {
    const execution = deferred<DocumentSnapshot>();
    const harness = createExecutor(execution);
    const gateway = new LocalProcessingGateway(harness.executor);
    const run = gateway.start(request, new AbortController().signal);

    await gateway.dispose();
    await expect(run.terminal).resolves.toEqual({ type: "cancelled" });
    expect(harness.dispose).toHaveBeenCalledOnce();
    expect(() => gateway.start(request, new AbortController().signal)).toThrow(
      "Processing gateway is disposed",
    );
  });
});
