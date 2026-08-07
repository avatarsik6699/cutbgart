import type { EnhancementWorkerCommand } from "./enhancement-worker-protocol";

export type EnhancementWorker = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  addEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  postMessage(message: EnhancementWorkerCommand, transfer?: Transferable[]): void;
  terminate(): void;
};

export type EnhancementWorkerFactory = { create(): EnhancementWorker };

export function createNativeEnhancementWorkerFactory(): EnhancementWorkerFactory {
  return {
    create: () =>
      new Worker(new URL("./worker/enhancement.worker.ts", import.meta.url), {
        type: "module",
      }),
  };
}
