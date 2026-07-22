import type {
  AlphaMatte,
  PixelRect,
  RefinementConstraintMap,
  Trimap,
} from "../../../entities/processed-image";

export function computeRefinementCrop(trimap: Trimap, padding = 32): PixelRect | null {
  const bounds = trimap.unknownBounds;
  if (!bounds) return null;
  const x = Math.max(0, bounds.x - padding);
  const y = Math.max(0, bounds.y - padding);
  return {
    x,
    y,
    width: Math.min(trimap.width, bounds.x + bounds.width + padding) - x,
    height: Math.min(trimap.height, bounds.y + bounds.height + padding) - y,
  };
}

export function cropAlphaMatte(matte: AlphaMatte, crop: PixelRect): AlphaMatte {
  if (
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.x + crop.width > matte.width ||
    crop.y + crop.height > matte.height
  ) {
    throw new Error("Focus crop is outside the alpha matte");
  }
  const data = new Uint8ClampedArray(crop.width * crop.height);
  for (let y = 0; y < crop.height; y += 1) {
    const start = (crop.y + y) * matte.width + crop.x;
    data.set(matte.data.subarray(start, start + crop.width), y * crop.width);
  }
  return { width: crop.width, height: crop.height, data };
}

function sampleBilinear(matte: AlphaMatte, x: number, y: number): number {
  const left = Math.max(0, Math.min(matte.width - 1, Math.floor(x)));
  const top = Math.max(0, Math.min(matte.height - 1, Math.floor(y)));
  const right = Math.min(matte.width - 1, left + 1);
  const bottom = Math.min(matte.height - 1, top + 1);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const topValue =
    (matte.data[top * matte.width + left] ?? 0) * (1 - fx) +
    (matte.data[top * matte.width + right] ?? 0) * fx;
  const bottomValue =
    (matte.data[bottom * matte.width + left] ?? 0) * (1 - fx) +
    (matte.data[bottom * matte.width + right] ?? 0) * fx;
  return Math.round(topValue * (1 - fy) + bottomValue * fy);
}

export function restoreRefinedCrop({
  predicted,
  prior,
  trimap,
  crop,
  constraints = null,
}: {
  predicted: AlphaMatte;
  prior: AlphaMatte;
  trimap: Trimap;
  crop: PixelRect;
  constraints?: RefinementConstraintMap | null;
}): AlphaMatte {
  if (
    prior.width !== trimap.width ||
    prior.height !== trimap.height ||
    prior.data.length !== trimap.data.length
  ) {
    throw new Error("Prior matte and trimap dimensions must match");
  }
  const data = prior.data.slice();
  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const targetIndex = (crop.y + y) * prior.width + crop.x + x;
      const trimapValue = trimap.data[targetIndex];
      if (trimapValue === 128) {
        const sampleX = ((x + 0.5) * predicted.width) / crop.width - 0.5;
        const sampleY = ((y + 0.5) * predicted.height) / crop.height - 0.5;
        data[targetIndex] = sampleBilinear(predicted, sampleX, sampleY);
      } else if (trimapValue === 0) data[targetIndex] = 0;
      else if (trimapValue === 255) data[targetIndex] = 255;
    }
  }
  for (let index = 0; index < data.length; index += 1) {
    const value = constraints?.data[index] ?? -1;
    if (value === 0) data[index] = 0;
    else if (value === 1) data[index] = 255;
  }
  return { width: prior.width, height: prior.height, data };
}
