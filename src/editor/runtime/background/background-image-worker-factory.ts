import type { BackgroundImageWorkerCommand } from "./background-image-protocol";

export type BackgroundImageWorker = {
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
  postMessage(message: BackgroundImageWorkerCommand, transfer: Transferable[]): void;
  terminate(): void;
};

export type BackgroundImageWorkerFactory = { create(): BackgroundImageWorker };

export function createNativeBackgroundImageWorkerFactory(): BackgroundImageWorkerFactory {
  return {
    create: () =>
      new Worker(new URL("./worker/background-image.worker.ts", import.meta.url), {
        type: "module",
      }),
  };
}
