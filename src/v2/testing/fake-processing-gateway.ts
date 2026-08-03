import {
  ProcessingGatewayError,
  type ProcessingGateway,
  type ProcessingRun,
  type ProcessingTerminalOutcome,
} from "@/v2/application";
import type {
  DocumentSnapshot,
  ProcessingError,
  ProcessingProgress,
  ProcessingRequest,
} from "@/v2/domain";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

export type FakeProcessingRun = {
  request: ProcessingRequest;
  signal: AbortSignal;
  publish(progress: ProcessingProgress): void;
  succeed(snapshot: DocumentSnapshot): void;
  fail(error: ProcessingError): void;
  cancel(): void;
  released(): boolean;
};

export class FakeProcessingGateway implements ProcessingGateway {
  readonly runs: FakeProcessingRun[] = [];
  #disposed = false;

  start(request: ProcessingRequest, signal: AbortSignal): ProcessingRun {
    if (this.#disposed) throw new Error("Fake processing gateway is disposed");
    const terminal = deferred<ProcessingTerminalOutcome>();
    const listeners = new Set<(progress: ProcessingProgress) => void>();
    let outcome: ProcessingTerminalOutcome | null = null;
    let released = false;
    const finish = (next: ProcessingTerminalOutcome) => {
      if (outcome !== null) return;
      outcome = next;
      terminal.resolve(next);
    };
    const run: FakeProcessingRun = {
      request,
      signal,
      publish(progress) {
        if (outcome === null) for (const listener of listeners) listener(progress);
      },
      succeed: (snapshot) => finish({ type: "succeeded", snapshot }),
      fail: (error) => finish({ type: "failed", error }),
      cancel: () => finish({ type: "cancelled" }),
      released: () => released,
    };
    this.runs.push(run);
    const cancel = () => run.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    const result = terminal.promise.then((next) => {
      if (next.type === "succeeded") return next.snapshot;
      const error: ProcessingError =
        next.type === "failed"
          ? next.error
          : { code: "aborted", message: "Cancelled", retryable: true };
      throw new ProcessingGatewayError(error);
    });
    void result.catch(() => undefined);
    return {
      runId: request.runId,
      result,
      terminal: terminal.promise,
      cancel,
      release() {
        if (released) return;
        released = true;
        signal.removeEventListener("abort", cancel);
        listeners.clear();
      },
      subscribe(listener) {
        if (!released) listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  dispose(): Promise<void> {
    if (this.#disposed) return Promise.resolve();
    this.#disposed = true;
    for (const run of this.runs) run.cancel();
    return Promise.resolve();
  }
}
