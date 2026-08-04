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
  #active = 0;
  #disposed = false;

  constructor(prepare: typeof prepareImageImport = prepareImageImport) {
    this.#prepare = prepare;
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
    if (index < 0) return;
    const [entry] = this.#pending.splice(index, 1);
    entry?.resolve({ ...entry.task, ok: false, error: "cancelled" });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
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
      void this.#prepare(entry.task.file)
        .then((result) => {
          entry.resolve(
            result.ok
              ? { ...entry.task, ok: true, value: result.value }
              : { ...entry.task, ok: false, error: result.error },
          );
        })
        .catch(() => {
          entry.resolve({ ...entry.task, ok: false, error: "preparation-failed" });
        })
        .finally(() => {
          this.#active -= 1;
          this.#drain();
        });
    }
  }
}
