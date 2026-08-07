import type { MagicWorkerCommand, MagicWorkerEvent } from "./magic-worker-protocol";

export type MagicWorker = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<MagicWorkerEvent>) => void,
  ): void;
  addEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  postMessage(message: MagicWorkerCommand, transfer?: Transferable[]): void;
  terminate(): void;
};

export type MagicWorkerFactory = { create(): MagicWorker };

export function createNativeMagicWorkerFactory(): MagicWorkerFactory {
  return {
    create() {
      return new Worker(new URL("./worker/magic-cutout.worker.ts", import.meta.url), {
        type: "module",
      });
    },
  };
}
