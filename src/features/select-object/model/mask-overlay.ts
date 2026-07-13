import type { AlphaMatte } from "../../../entities/processed-image";

const OVERLAY_COLOR = [14, 165, 233] as const;

/**
 * Resamples a source-sized matte into the visible preview and colors only the
 * selected foreground. Keeping the output at display resolution avoids a
 * temporary 64 MiB RGBA allocation for a 4096×4096 upload.
 */
export function createMaskOverlayPixels(
  matte: AlphaMatte,
  displayWidth: number,
  displayHeight: number,
): Uint8ClampedArray<ArrayBuffer> {
  const width = Math.max(1, Math.round(displayWidth));
  const height = Math.max(1, Math.round(displayHeight));
  const output = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(matte.height - 1, Math.floor((y / height) * matte.height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(matte.width - 1, Math.floor((x / width) * matte.width));
      const alpha = matte.data[sourceY * matte.width + sourceX] ?? 0;
      const offset = (y * width + x) * 4;
      output[offset] = OVERLAY_COLOR[0];
      output[offset + 1] = OVERLAY_COLOR[1];
      output[offset + 2] = OVERLAY_COLOR[2];
      output[offset + 3] = Math.round(alpha * 0.45);
    }
  }

  return output;
}
