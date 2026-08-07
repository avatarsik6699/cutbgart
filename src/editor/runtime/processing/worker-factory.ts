import type { ProcessingWorkerCommand, ProcessingWorkerEvent } from "./worker-protocol";

export type ProcessingWorker = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ProcessingWorkerEvent>) => void,
  ): void;
  addEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  postMessage(message: ProcessingWorkerCommand, transfer?: Transferable[]): void;
  terminate(): void;
};

export type ProcessingWorkerFactory = {
  create(): ProcessingWorker;
};

export function createNativeProcessingWorkerFactory(): ProcessingWorkerFactory {
  return {
    create() {
      return new Worker(new URL("./worker/processing.worker.ts", import.meta.url), {
        type: "module",
      });
    },
  };
}
