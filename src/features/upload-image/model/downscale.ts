import type { SourceImage } from "../../../entities/processed-image";

/**
 * Resizes an already-decoded bitmap so its longest side fits `maxDimension`,
 * re-encoding to `mimeType` via `OffscreenCanvas` (SPEC.md §1.3/§7.1 — large
 * uploads are downscaled client-side before inference, not rejected).
 */
export async function downscaleToFit(
  bitmap: ImageBitmap,
  maxDimension: number,
  mimeType: SourceImage["format"],
): Promise<SourceImage> {
  const scale = maxDimension / Math.max(bitmap.width, bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable for client-side downscale");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await canvas.convertToBlob({
    type: mimeType,
    quality: mimeType === "image/jpeg" ? 0.92 : undefined,
  });

  return { blob, width, height, format: mimeType };
}
