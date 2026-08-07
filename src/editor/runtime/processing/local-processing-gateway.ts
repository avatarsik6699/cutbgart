import {
  ProcessingGatewayError,
  type ProcessingGateway,
  type ProcessingRun,
  type ProcessingTerminalOutcome,
} from "@/editor/application";
import type {
  DocumentSnapshot,
  ProcessingError,
  ProcessingProgress,
  ProcessingRequest,
} from "@/editor/domain";
import { HeavyJobCoordinator } from "./heavy-job-coordinator";

export type LocalProcessingExecutor = {
  execute(
    request: ProcessingRequest,
    signal: AbortSignal,
    publish: (progress: ProcessingProgress) => void,
  ): Promise<DocumentSnapshot>;
  dispose(): Promise<void>;
};

type ActiveRun = {
  cancel(): void;
  release(): void;
};

function cancelledError(): ProcessingError {
  return { code: "aborted", message: "Processing was cancelled", retryable: true };
}

function normalizeError(error: unknown): ProcessingError {
  if (error instanceof ProcessingGatewayError) {
    return error.detail;
  }
  if (error instanceof Error) {
    return { code: "processing-failed", message: error.message, retryable: true };
  }
  return { code: "processing-failed", message: "Processing failed", retryable: true };
}

export class LocalProcessingGateway implements ProcessingGateway {
  readonly #activeRuns = new Set<ActiveRun>();
  readonly #executor: LocalProcessingExecutor;
  readonly #coordinator: HeavyJobCoordinator;
  readonly #ownsCoordinator: boolean;
  #disposed = false;

  constructor(executor: LocalProcessingExecutor, coordinator?: HeavyJobCoordinator) {
    this.#executor = executor;
    this.#coordinator = coordinator ?? new HeavyJobCoordinator();
    this.#ownsCoordinator = coordinator === undefined;
  }

  start(request: ProcessingRequest, signal: AbortSignal): ProcessingRun {
    if (this.#disposed) {
      throw new ProcessingGatewayError({
        code: "processing-failed",
        message: "Processing gateway is disposed",
        retryable: false,
      });
    }

    const controller = new AbortController();
    const listeners = new Set<(progress: ProcessingProgress) => void>();
    let released = false;
    let terminalReached = false;

    function cancel(): void {
      if (!controller.signal.aborted && !terminalReached) {
        controller.abort(new ProcessingGatewayError(cancelledError()));
      }
    }

    function externalAbortFx(): void {
      cancel();
    }

    if (signal.aborted) {
      cancel();
    } else {
      signal.addEventListener("abort", externalAbortFx, { once: true });
    }

    let execution: Promise<DocumentSnapshot>;
    try {
      execution = this.#coordinator.schedule({
        kind: "automatic-remove",
        signal: controller.signal,
        execute: (admittedSignal) =>
          this.#executor.execute(request, admittedSignal, (progress) => {
            if (
              released ||
              terminalReached ||
              admittedSignal.aborted ||
              progress.documentId !== request.documentId ||
              progress.runId !== request.runId ||
              progress.expectedRevision !== request.expectedRevision
            ) {
              return;
            }
            for (const listener of listeners) listener(progress);
          }),
      });
    } catch (error) {
      execution = Promise.reject(
        error instanceof Error
          ? error
          : new Error("Local processing executor failed to start"),
      );
    }
    execution.catch(() => undefined);

    const cancellation = new Promise<never>((_resolve, reject) => {
      function rejectCancellationFx(): void {
        reject(new ProcessingGatewayError(cancelledError()));
      }

      if (controller.signal.aborted) {
        rejectCancellationFx();
      } else {
        controller.signal.addEventListener("abort", rejectCancellationFx, { once: true });
      }
    });

    const result = Promise.race([execution, cancellation]).then((snapshot) => {
      if (controller.signal.aborted) {
        throw new ProcessingGatewayError(cancelledError());
      }
      return snapshot;
    });
    const terminal: Promise<ProcessingTerminalOutcome> = result.then(
      (snapshot) => ({ type: "succeeded", snapshot }),
      (error: unknown) => {
        if (controller.signal.aborted) {
          return { type: "cancelled" };
        }
        return { type: "failed", error: normalizeError(error) };
      },
    );

    const release = () => {
      if (released) {
        return;
      }
      released = true;
      cancel();
      listeners.clear();
      signal.removeEventListener("abort", externalAbortFx);
      this.#activeRuns.delete(activeRun);
    };
    const activeRun: ActiveRun = { cancel, release };
    this.#activeRuns.add(activeRun);

    void terminal.finally(() => {
      terminalReached = true;
      signal.removeEventListener("abort", externalAbortFx);
    });

    return {
      runId: request.runId,
      result,
      terminal,
      cancel,
      release,
      subscribe(listener) {
        if (released || terminalReached) {
          return () => undefined;
        }
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    for (const run of [...this.#activeRuns]) {
      run.cancel();
      run.release();
    }
    if (this.#ownsCoordinator) this.#coordinator.dispose();
    await this.#executor.dispose();
  }
}
