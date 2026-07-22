import { estimateForegroundPixels } from "../model/estimate-foreground";
import type {
  ForegroundRefinementError,
  ForegroundRefinementRequest,
  ForegroundRefinementResult,
  ForegroundRefinementWorkerRequest,
  ForegroundRefinementWorkerResponse,
} from "../model/types";

interface WorkerScope {
  postMessage(
    message: ForegroundRefinementWorkerResponse,
    transfer?: Transferable[],
  ): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ForegroundRefinementWorkerRequest>) => void,
  ): void;
}

interface MemoryPerformance extends Performance {
  memory?: { usedJSHeapSize?: number };
}

const scope = globalThis as unknown as WorkerScope;
let activeRequestId: string | null = null;

function post(
  message: ForegroundRefinementWorkerResponse,
  transfer?: Transferable[],
): void {
  scope.postMessage(message, transfer);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function memoryObservation(): number | "unavailable" {
  const observed = (performance as MemoryPerformance).memory?.usedJSHeapSize;
  return typeof observed === "number" && Number.isFinite(observed)
    ? observed
    : "unavailable";
}

function isOutOfMemory(error: unknown): boolean {
  return /out of memory|oom|allocation failed|bad_alloc/i.test(messageOf(error));
}

function validateRequest(request: ForegroundRefinementRequest): void {
  const pixels = request.source.width * request.source.height;
  if (
    request.source.width !== request.matte.width ||
    request.source.height !== request.matte.height ||
    request.matte.data.length !== pixels
  ) {
    throw new Error("Foreground refinement source and matte dimensions must match");
  }
  if (
    request.constraints &&
    (request.constraints.width !== request.matte.width ||
      request.constraints.height !== request.matte.height ||
      request.constraints.data.length !== pixels)
  ) {
    throw new Error("Foreground refinement constraint dimensions must match the matte");
  }
}

async function decodeSource(
  request: ForegroundRefinementRequest,
): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(request.source.blob);
  try {
    const canvas = new OffscreenCanvas(request.source.width, request.source.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Foreground refinement 2D context is unavailable");
    context.drawImage(bitmap, 0, 0, request.source.width, request.source.height);
    return context.getImageData(0, 0, request.source.width, request.source.height).data;
  } finally {
    bitmap.close();
  }
}

async function encodeForeground(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Foreground refinement 2D context is unavailable");
  const imagePixels = new Uint8ClampedArray(rgba.length);
  imagePixels.set(rgba);
  context.putImageData(new ImageData(imagePixels, width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

async function handleRefine(request: ForegroundRefinementRequest): Promise<void> {
  activeRequestId = request.requestId;
  const startedAt = performance.now();
  const startedMemory = memoryObservation();
  validateRequest(request);
  post({ type: "progress", requestId: request.requestId, percent: 0 });
  const sourceRgba = await decodeSource(request);
  if (activeRequestId !== request.requestId) return;

  let pixelResult;
  try {
    pixelResult = estimateForegroundPixels({
      rgba: sourceRgba,
      matte: request.matte,
      constraints: request.constraints,
      componentCleanup: request.componentCleanup ?? true,
    });
  } catch (error) {
    post({
      type: "fallback",
      requestId: request.requestId,
      fallback: "processing-failed",
      reason: messageOf(error),
    });
    pixelResult = {
      rgba: sourceRgba,
      matte: request.matte,
      dirtyPatch: null,
      actualPath: "unchanged" as const,
      fallback: "processing-failed" as const,
      fallbackReason: messageOf(error),
    };
  }
  if (activeRequestId !== request.requestId) return;
  if (pixelResult.fallback !== "none" && pixelResult.fallback !== "processing-failed") {
    post({
      type: "fallback",
      requestId: request.requestId,
      fallback: pixelResult.fallback,
      reason: pixelResult.fallbackReason ?? pixelResult.fallback,
    });
  }
  post({ type: "progress", requestId: request.requestId, percent: 100 });
  const foreground = await encodeForeground(
    pixelResult.rgba,
    request.source.width,
    request.source.height,
  );
  if (activeRequestId !== request.requestId) return;
  const result: ForegroundRefinementResult = {
    foreground,
    matte: pixelResult.matte,
    dirtyPatch: pixelResult.dirtyPatch,
    requestedPath: "decontaminate",
    actualPath: pixelResult.actualPath,
    fallback: pixelResult.fallback,
    ...(pixelResult.fallbackReason ? { fallbackReason: pixelResult.fallbackReason } : {}),
    durationMs: performance.now() - startedAt,
    memoryBytes: (() => {
      const finishedMemory = memoryObservation();
      return typeof startedMemory === "number" && typeof finishedMemory === "number"
        ? Math.max(0, finishedMemory - startedMemory)
        : "unavailable";
    })(),
  };
  const transfer: Transferable[] = [result.matte.data.buffer];
  if (result.dirtyPatch) transfer.push(result.dirtyPatch.rgba.buffer);
  post({ type: "result", requestId: request.requestId, result }, transfer);
}

scope.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "refine-foreground") {
    void handleRefine(message.request).catch((error: unknown) => {
      if (activeRequestId !== message.request.requestId) return;
      const detail: ForegroundRefinementError = {
        code: isOutOfMemory(error)
          ? "device-out-of-memory"
          : /dimensions must match/i.test(messageOf(error))
            ? "invalid-input"
            : "processing-failed",
        message: messageOf(error),
        recoverable: !/dimensions must match/i.test(messageOf(error)),
      };
      post({ type: "error", requestId: message.request.requestId, error: detail });
    });
    return;
  }
  if (activeRequestId === message.requestId || message.type === "dispose") {
    activeRequestId = null;
  }
  if (message.type === "dispose") {
    post({ type: "disposed", requestId: message.requestId });
  }
});
