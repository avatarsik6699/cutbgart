import { createNativeExportWorker } from "./export-worker-factory";

type ResizableMediaType = "image/jpeg" | "image/png" | "image/webp";

export async function resizeImageInWorker(
  blob: Blob,
  dimensions: Readonly<{ width: number; height: number }>,
  mediaType: ResizableMediaType,
  signal?: AbortSignal,
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException("Image resize cancelled", "AbortError");
  const worker = createNativeExportWorker();
  return new Promise<Blob>((resolve, reject) => {
    function finish() {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    }
    function abort() {
      finish();
      reject(new DOMException("Image resize cancelled", "AbortError"));
    }
    signal?.addEventListener("abort", abort, { once: true });
    worker.addEventListener(
      "message",
      (
        event: MessageEvent<
          | Readonly<{ blob: Blob; type: "RESIZED" }>
          | Readonly<{ message: string; type: "FAILED" }>
        >,
      ) => {
        finish();
        if (event.data.type === "RESIZED") resolve(event.data.blob);
        else reject(new Error(event.data.message));
      },
      { once: true },
    );
    worker.addEventListener(
      "error",
      () => {
        finish();
        reject(new Error("Image resize worker failed"));
      },
      { once: true },
    );
    try {
      worker.postMessage({
        type: "RESIZE_EXPORT",
        blob,
        mediaType,
        ...dimensions,
      });
    } catch (error) {
      finish();
      reject(error instanceof Error ? error : new Error("Image resize post failed"));
    }
  });
}

export function resizeExportPng(
  blob: Blob,
  dimensions: Readonly<{ width: number; height: number }>,
  signal: AbortSignal,
): Promise<Blob> {
  return resizeImageInWorker(blob, dimensions, "image/png", signal);
}
