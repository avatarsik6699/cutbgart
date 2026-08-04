import type {
  ProcessingCancellation,
  ProcessingCancellationSource,
} from "@/v2/application";

import { createNativeProcessingCancellationSource } from "../platform";
import { prepareImageImport } from "../editor-session/image-import-preparation";
import {
  IMPORT_PREPARATION_CONCURRENCY,
  type BatchImportResult,
  type BatchImportTask,
} from "./batch-import.types";

type PendingTask = {
  task: BatchImportTask;
  resolve(result: BatchImportResult): void;
};

export class BatchImportCoordinator {
  readonly #pending: PendingTask[] = [];
  readonly #prepare: typeof prepareImageImport;
  readonly #activeControllers = new Map<
    BatchImportTask["itemId"],
    ProcessingCancellation
  >();
  readonly #cancellation: ProcessingCancellationSource;
  #active = 0;
  #disposed = false;

  constructor(
    prepare: typeof prepareImageImport = prepareImageImport,
    cancellation: ProcessingCancellationSource = createNativeProcessingCancellationSource(),
  ) {
    this.#prepare = prepare;
    this.#cancellation = cancellation;
  }

  prepare(task: BatchImportTask): Promise<BatchImportResult> {
    if (this.#disposed)
      return Promise.resolve({ ...task, ok: false, error: "cancelled" });
    return new Promise((resolve) => {
      this.#pending.push({ task, resolve });
      this.#drain();
    });
  }

  cancel(itemId: BatchImportTask["itemId"]): void {
    const index = this.#pending.findIndex((entry) => entry.task.itemId === itemId);
    if (index < 0) {
      this.#activeControllers.get(itemId)?.abort();
      return;
    }
    const [entry] = this.#pending.splice(index, 1);
    entry?.resolve({ ...entry.task, ok: false, error: "cancelled" });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const controller of this.#activeControllers.values()) controller.abort();
    for (const entry of this.#pending.splice(0))
      entry.resolve({ ...entry.task, ok: false, error: "cancelled" });
  }

  #drain(): void {
    while (
      !this.#disposed &&
      this.#active < IMPORT_PREPARATION_CONCURRENCY &&
      this.#pending.length > 0
    ) {
      const entry = this.#pending.shift();
      if (entry === undefined) return;
      this.#active += 1;
      const controller = this.#cancellation.create();
      this.#activeControllers.set(entry.task.itemId, controller);
      void this.#prepare(entry.task.file, undefined, controller.signal)
        .then((result) => {
          entry.resolve(
            result.ok
              ? { ...entry.task, ok: true, value: result.value }
              : { ...entry.task, ok: false, error: result.error },
          );
        })
        .catch((error: unknown) => {
          entry.resolve({
            ...entry.task,
            ok: false,
            error:
              controller.signal.aborted ||
              (error instanceof DOMException && error.name === "AbortError")
                ? "cancelled"
                : "preparation-failed",
          });
        })
        .finally(() => {
          this.#activeControllers.delete(entry.task.itemId);
          this.#active -= 1;
          this.#drain();
        });
    }
  }
}
