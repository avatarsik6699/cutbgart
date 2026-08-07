import type { BackgroundImageCorrelation } from "./background-image-protocol";
import {
  BACKGROUND_IMAGE_MAX_BYTES,
  BACKGROUND_IMAGE_PROTOCOL_VERSION,
  isBackgroundImageWorkerEvent,
  sameBackgroundImageCorrelation,
  type BackgroundImageMediaType,
} from "./background-image-protocol";
import {
  createNativeBackgroundImageWorkerFactory,
  type BackgroundImageWorkerFactory,
} from "./background-image-worker-factory";

export type PreparedBackgroundImage = {
  blob: Blob;
  mediaType: BackgroundImageMediaType;
  width: number;
  height: number;
};

export type BackgroundImagePreparer = {
  prepare(
    file: File,
    correlation: BackgroundImageCorrelation,
    signal: AbortSignal,
  ): Promise<PreparedBackgroundImage>;
};

function mediaTypeOf(file: File): BackgroundImageMediaType | null {
  return file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp"
    ? file.type
    : null;
}

function cancelledError(): Error {
  const error = new Error("Background image preparation cancelled");
  error.name = "AbortError";
  return error;
}

export class BackgroundImageClient implements BackgroundImagePreparer {
  readonly #factory: BackgroundImageWorkerFactory;

  constructor(
    factory: BackgroundImageWorkerFactory = createNativeBackgroundImageWorkerFactory(),
  ) {
    this.#factory = factory;
  }

  async prepare(
    file: File,
    correlation: BackgroundImageCorrelation,
    signal: AbortSignal,
  ): Promise<PreparedBackgroundImage> {
    const mediaType = mediaTypeOf(file);
    if (mediaType === null) throw new Error("Unsupported background image format");
    if (file.size > BACKGROUND_IMAGE_MAX_BYTES)
      throw new Error("Background image exceeds the 20 MiB limit");
    if (signal.aborted) throw cancelledError();
    const bytes = await file.arrayBuffer();
    if (signal.aborted) throw cancelledError();
    const worker = this.#factory.create();
    return new Promise<PreparedBackgroundImage>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        signal.removeEventListener("abort", abortFx);
        worker.removeEventListener("message", messageFx);
        worker.removeEventListener("error", crashFx);
        worker.removeEventListener("messageerror", crashFx);
        worker.terminate();
      };
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const abortFx = (): void => fail(cancelledError());
      const crashFx = (): void => fail(new Error("Background image worker crashed"));
      const messageFx = (event: MessageEvent<unknown>): void => {
        if (!isBackgroundImageWorkerEvent(event.data))
          return fail(new Error("Invalid background image worker event"));
        if (!sameBackgroundImageCorrelation(event.data.correlation, correlation)) return;
        if (event.data.type === "FAILED") return fail(new Error(event.data.message));
        settled = true;
        cleanup();
        resolve({
          blob: new Blob([event.data.bytes], { type: event.data.mediaType }),
          mediaType: event.data.mediaType,
          width: event.data.width,
          height: event.data.height,
        });
      };
      signal.addEventListener("abort", abortFx, { once: true });
      worker.addEventListener("message", messageFx);
      worker.addEventListener("error", crashFx);
      worker.addEventListener("messageerror", crashFx);
      worker.postMessage(
        {
          protocol: BACKGROUND_IMAGE_PROTOCOL_VERSION,
          type: "PREPARE_BACKGROUND_IMAGE",
          correlation,
          bytes,
          mediaType,
        },
        [bytes],
      );
    });
  }
}
