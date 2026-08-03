export type HeavyJobKind = "automatic-remove" | "magic-cutout";

export type HeavyJobRequest<T> = {
  kind: HeavyJobKind;
  signal: AbortSignal;
  execute: (signal: AbortSignal) => Promise<T>;
};

type QueuedJob = HeavyJobRequest<unknown> & {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  queuedAbortFx: () => void;
};

function abortError(): DOMException {
  return new DOMException("Heavy job was cancelled", "AbortError");
}

export class HeavyJobCoordinator {
  readonly #queue: QueuedJob[] = [];
  #activeController: AbortController | null = null;
  #disposed = false;

  get active(): boolean {
    return this.#activeController !== null;
  }

  get queued(): number {
    return this.#queue.length;
  }

  schedule<T>(request: HeavyJobRequest<T>): Promise<T> {
    if (this.#disposed)
      return Promise.reject(new Error("Heavy job coordinator is disposed"));
    if (request.signal.aborted) return Promise.reject(abortError());

    return new Promise<T>((resolve, reject) => {
      const job: QueuedJob = {
        kind: request.kind,
        signal: request.signal,
        execute: request.execute,
        resolve: (value) => resolve(value as T),
        reject,
        queuedAbortFx: () => undefined,
      };
      job.queuedAbortFx = () => {
        const index = this.#queue.indexOf(job);
        if (index < 0) return;
        this.#queue.splice(index, 1);
        request.signal.removeEventListener("abort", job.queuedAbortFx);
        reject(abortError());
      };
      request.signal.addEventListener("abort", job.queuedAbortFx, { once: true });
      this.#queue.push(job);
      this.#drain();
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#activeController?.abort(abortError());
    for (const job of this.#queue.splice(0)) {
      job.signal.removeEventListener("abort", job.queuedAbortFx);
      job.reject(abortError());
    }
  }

  #drain(): void {
    if (this.#disposed || this.#activeController !== null) return;
    const job = this.#queue.shift();
    if (job === undefined) return;
    job.signal.removeEventListener("abort", job.queuedAbortFx);
    if (job.signal.aborted) {
      job.reject(abortError());
      this.#drain();
      return;
    }

    const controller = new AbortController();
    this.#activeController = controller;
    function externalAbortFx(): void {
      controller.abort(abortError());
    }
    job.signal.addEventListener("abort", externalAbortFx, { once: true });

    let execution: Promise<unknown>;
    try {
      execution = job.execute(controller.signal);
    } catch (error) {
      execution = Promise.reject(
        error instanceof Error ? error : new Error("Heavy job failed to start"),
      );
    }
    void execution
      .then(job.resolve, (error: unknown) => {
        job.reject(error instanceof Error ? error : new Error("Heavy job failed"));
      })
      .finally(() => {
        job.signal.removeEventListener("abort", externalAbortFx);
        if (this.#activeController === controller) this.#activeController = null;
        this.#drain();
      });
  }
}
