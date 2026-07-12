import type {
  AlphaMatte,
  BackgroundFill,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";

export interface BackgroundGeometry {
  width: number;
  height: number;
}

export function getCoverRect(
  source: BackgroundGeometry,
  target: BackgroundGeometry,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    x: (target.width - width) / 2,
    y: (target.height - height) / 2,
    width,
    height,
  };
}

async function drawBackground(
  context: OffscreenCanvasRenderingContext2D,
  fill: BackgroundFill,
  width: number,
  height: number,
): Promise<void> {
  if (fill.type === "transparent") return;
  if (fill.type === "color") {
    context.fillStyle = fill.value;
    context.fillRect(0, 0, width, height);
    return;
  }
  if (fill.type === "gradient") {
    const gradient =
      fill.kind === "linear"
        ? context.createLinearGradient(0, height / 2, width, height / 2)
        : context.createRadialGradient(
            width / 2,
            height / 2,
            0,
            width / 2,
            height / 2,
            Math.hypot(width / 2, height / 2),
          );
    for (const stop of fill.stops) gradient.addColorStop(stop.offset, stop.color);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return;
  }
  const bitmap = await createImageBitmap(fill.blob);
  try {
    const rect = getCoverRect(bitmap, { width, height });
    context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
  } finally {
    bitmap.close();
  }
}

/**
 * Overwrites the alpha channel of an RGBA pixel buffer with a single-channel
 * alpha matte. Pure — no canvas/DOM dependency, so it is unit-testable without
 * a real `OffscreenCanvas` (SPEC.md §7.7).
 */
export function applyAlphaMatte(
  rgba: Uint8ClampedArray,
  matte: AlphaMatte,
): Uint8ClampedArray {
  const pixelCount = matte.width * matte.height;
  if (rgba.length !== pixelCount * 4) {
    throw new Error(
      `applyAlphaMatte: pixel buffer size (${String(rgba.length)}) does not match matte dimensions (${String(matte.width)}x${String(matte.height)})`,
    );
  }
  const result = new Uint8ClampedArray(rgba);
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    result[pixel * 4 + 3] = matte.data[pixel] ?? 0;
  }
  return result;
}

/**
 * Decodes the source image, applies the alpha matte, and composites the
 * result into a downloadable PNG-with-alpha blob — runs inside the
 * `remove-background` Web Worker (SPEC.md §5.2).
 */
export async function compositeProcessedImage(
  source: SourceImage,
  matte: AlphaMatte,
  qualityMode: QualityMode,
  backgroundFill: BackgroundFill = { type: "transparent" },
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(source.blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("compositeProcessedImage: 2D OffscreenCanvas context unavailable");
  }

  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData.data.set(applyAlphaMatte(imageData.data, matte));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(imageData, 0, 0);
  const cutout = await canvas.convertToBlob({ type: "image/png" });
  ctx.globalCompositeOperation = "destination-over";
  await drawBackground(ctx, backgroundFill, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  bitmap.close();

  const result =
    backgroundFill.type === "transparent"
      ? cutout
      : await canvas.convertToBlob({ type: "image/png" });

  return {
    source,
    result,
    cutout,
    qualityMode,
    alphaMatte: matte,
    backgroundFill,
    backgroundPending: false,
  };
}

/**
 * Reads the alpha channel back out of an already-composited PNG-with-alpha
 * blob — the composited PNG's alpha channel *is* the `AlphaMatte` the model
 * produced (SPEC.md §2.2), pixel-for-pixel, since `compositeProcessedImage`
 * writes it there and nowhere else. This lets the manual-correction flow
 * (Phase 07) recover the working matte on the main thread without touching
 * `worker/inference.worker.ts` or re-running inference.
 */
export async function extractAlphaMatte(result: Blob): Promise<AlphaMatte> {
  const bitmap = await createImageBitmap(result);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("extractAlphaMatte: 2D OffscreenCanvas context unavailable");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const matteData = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let pixel = 0; pixel < matteData.length; pixel++) {
    matteData[pixel] = data[pixel * 4 + 3] ?? 0;
  }

  return { width: canvas.width, height: canvas.height, data: matteData };
}

/**
 * Re-composites `image.source` with a corrected `AlphaMatte` — no inference,
 * pure canvas math re-run through the same pipeline `compositeProcessedImage`
 * uses (Phase 07, SPEC.md §5.2/§5.3's `correcting` state).
 */
export async function recompositeProcessedImage(
  image: ProcessedImage,
  matte: AlphaMatte,
  backgroundFill: BackgroundFill = image.backgroundFill ?? { type: "transparent" },
): Promise<ProcessedImage> {
  return compositeProcessedImage(image.source, matte, image.qualityMode, backgroundFill);
}
