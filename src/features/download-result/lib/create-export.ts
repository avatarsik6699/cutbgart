import type { ExportSettings, ExportSize } from "../model/types";

export interface ExportSourceDimensions {
  width: number;
  height: number;
}

export interface CreatedExport {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
}

interface DecodedImage {
  width: number;
  height: number;
  close(): void;
}

interface ExportCanvas {
  getContext(contextId: "2d"): {
    drawImage(
      image: CanvasImageSource,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ): void;
  } | null;
  convertToBlob(options: { type: "image/png" }): Promise<Blob>;
}

export interface CreateExportRuntime {
  decode: (blob: Blob) => Promise<DecodedImage>;
  createCanvas: (width: number, height: number) => ExportCanvas;
  yieldToBrowser: () => Promise<void>;
}

function abortError(): DOMException {
  return new DOMException("Export cancelled", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function defaultRuntime(): CreateExportRuntime {
  return {
    decode: (blob) => createImageBitmap(blob),
    createCanvas: (width, height) => new OffscreenCanvas(width, height),
    yieldToBrowser: () =>
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }),
  };
}

export function availableExportSizes({
  width,
  height,
}: ExportSourceDimensions): readonly ExportSize[] {
  const longest = Math.max(width, height);
  return [
    "original" as const,
    ...(longest > 2048 ? ([2048] as const) : []),
    ...(longest > 1024 ? ([1024] as const) : []),
  ];
}

export function calculateExportDimensions(
  source: ExportSourceDimensions,
  longestSide: ExportSize,
): ExportSourceDimensions {
  const sourceLongest = Math.max(source.width, source.height);
  if (longestSide === "original" || longestSide >= sourceLongest) return source;
  const scale = longestSide / sourceLongest;
  return source.width >= source.height
    ? {
        width: longestSide,
        height: Math.max(1, Math.round(source.height * scale)),
      }
    : {
        width: Math.max(1, Math.round(source.width * scale)),
        height: longestSide,
      };
}

export function createExportFileName(longestSide: ExportSize): string {
  return longestSide === "original" ? "result.png" : `result-${String(longestSide)}.png`;
}

export async function createExport(
  image: Blob,
  source: ExportSourceDimensions,
  settings: ExportSettings,
  options: {
    signal?: AbortSignal;
    runtime?: CreateExportRuntime;
  } = {},
): Promise<CreatedExport> {
  const { signal } = options;
  throwIfAborted(signal);
  const dimensions = calculateExportDimensions(source, settings.longestSide);
  const fileName = createExportFileName(settings.longestSide);
  if (dimensions.width === source.width && dimensions.height === source.height) {
    return { blob: image, ...dimensions, fileName };
  }

  const runtime = options.runtime ?? defaultRuntime();
  await runtime.yieldToBrowser();
  throwIfAborted(signal);
  const decoded = await runtime.decode(image);
  try {
    throwIfAborted(signal);
    const canvas = runtime.createCanvas(dimensions.width, dimensions.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable in this browser.");
    context.drawImage(decoded, 0, 0, dimensions.width, dimensions.height);
    throwIfAborted(signal);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    throwIfAborted(signal);
    return { blob, ...dimensions, fileName };
  } finally {
    decoded.close();
  }
}
