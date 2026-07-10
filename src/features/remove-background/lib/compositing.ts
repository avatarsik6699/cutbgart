import type {
  AlphaMatte,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";

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
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(source.blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("compositeProcessedImage: 2D OffscreenCanvas context unavailable");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData.data.set(applyAlphaMatte(imageData.data, matte));
  ctx.putImageData(imageData, 0, 0);

  const result = await canvas.convertToBlob({ type: "image/png" });

  return { source, result, qualityMode };
}
