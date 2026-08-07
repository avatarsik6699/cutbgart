import type { LocalInferencePath } from "@/v2/domain";

import type { EnhancementPixelTypes } from "./enhancement-pixels.types";

export const MAX_MATTING_INPUT_SIDE = 1024;
export const MAX_MATTING_INPUT_PIXELS = 1024 * 1024;

export type MattingAttempt = {
  mode: "balanced" | "maximum";
  path: LocalInferencePath;
};

function assertAlphaPlane(matte: EnhancementPixelTypes.AlphaPlane): void {
  if (
    !Number.isSafeInteger(matte.width) ||
    !Number.isSafeInteger(matte.height) ||
    matte.width <= 0 ||
    matte.height <= 0 ||
    matte.data.length !== matte.width * matte.height
  ) {
    throw new Error("Enhancement matte dimensions are invalid");
  }
}

function bounds(
  mask: Uint8Array,
  width: number,
  height: number,
): EnhancementPixelTypes.Rect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX < 0
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function dilate(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  let current = mask;
  for (let pass = 0; pass < radius; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (current[index] === 1) continue;
        for (let offsetY = -1; offsetY <= 1 && next[index] !== 1; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;
            if (current[sampleY * width + sampleX] === 1) {
              next[index] = 1;
              break;
            }
          }
        }
      }
    }
    current = next;
  }
  return current;
}

export function buildRefinementTrimap(
  matte: EnhancementPixelTypes.AlphaPlane,
): EnhancementPixelTypes.Trimap {
  assertAlphaPlane(matte);
  const uncertain = new Uint8Array(matte.data.length);
  function classify(value: number): 0 | 1 | 2 {
    if (value <= 16) return 0;
    if (value >= 239) return 2;
    return 1;
  }
  for (let index = 0; index < matte.data.length; index += 1) {
    if (classify(matte.data[index] ?? 0) === 1) uncertain[index] = 1;
  }
  for (let y = 0; y < matte.height; y += 1) {
    for (let x = 0; x < matte.width; x += 1) {
      const index = y * matte.width + x;
      const current = classify(matte.data[index] ?? 0);
      if (x + 1 < matte.width) {
        const right = index + 1;
        if (Math.abs(current - classify(matte.data[right] ?? 0)) >= 2) {
          uncertain[index] = 1;
          uncertain[right] = 1;
        }
      }
      if (y + 1 < matte.height) {
        const bottom = index + matte.width;
        if (Math.abs(current - classify(matte.data[bottom] ?? 0)) >= 2) {
          uncertain[index] = 1;
          uncertain[bottom] = 1;
        }
      }
    }
  }
  const radius = Math.max(
    1,
    Math.min(8, Math.round(Math.min(matte.width, matte.height) / 192)),
  );
  const expanded = dilate(uncertain, matte.width, matte.height, radius);
  const data = new Uint8ClampedArray(matte.data.length);
  for (let index = 0; index < data.length; index += 1) {
    const alpha = matte.data[index] ?? 0;
    if (expanded[index] === 1) data[index] = 128;
    else data[index] = alpha >= 128 ? 255 : 0;
  }
  return {
    width: matte.width,
    height: matte.height,
    data,
    unknownBounds: bounds(expanded, matte.width, matte.height),
  };
}

export function computeRefinementCrop(
  trimap: EnhancementPixelTypes.Trimap,
  padding = 32,
): EnhancementPixelTypes.Rect | null {
  const unknown = trimap.unknownBounds;
  if (unknown === null) return null;
  const x = Math.max(0, unknown.x - padding);
  const y = Math.max(0, unknown.y - padding);
  return {
    x,
    y,
    width: Math.min(trimap.width, unknown.x + unknown.width + padding) - x,
    height: Math.min(trimap.height, unknown.y + unknown.height + padding) - y,
  };
}

export function computeMattingInputSize(
  crop: Pick<EnhancementPixelTypes.Rect, "width" | "height">,
): {
  width: number;
  height: number;
} {
  if (crop.width <= 0 || crop.height <= 0)
    throw new Error("Matting crop dimensions must be positive");
  const scale = Math.min(
    1,
    MAX_MATTING_INPUT_SIDE / crop.width,
    MAX_MATTING_INPUT_SIDE / crop.height,
    Math.sqrt(MAX_MATTING_INPUT_PIXELS / (crop.width * crop.height)),
  );
  return {
    width: Math.max(1, Math.round(crop.width * scale)),
    height: Math.max(1, Math.round(crop.height * scale)),
  };
}

function bilinear(matte: EnhancementPixelTypes.AlphaPlane, x: number, y: number): number {
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);
  const left = Math.max(0, Math.min(matte.width - 1, floorX));
  const top = Math.max(0, Math.min(matte.height - 1, floorY));
  const right = Math.min(matte.width - 1, left + 1);
  const bottom = Math.min(matte.height - 1, top + 1);
  const fx = x - floorX;
  const fy = y - floorY;
  const topValue =
    (matte.data[top * matte.width + left] ?? 0) * (1 - fx) +
    (matte.data[top * matte.width + right] ?? 0) * fx;
  const bottomValue =
    (matte.data[bottom * matte.width + left] ?? 0) * (1 - fx) +
    (matte.data[bottom * matte.width + right] ?? 0) * fx;
  return Math.round(topValue * (1 - fy) + bottomValue * fy);
}

export function restoreRefinedCrop(input: {
  predicted: EnhancementPixelTypes.AlphaPlane;
  prior: EnhancementPixelTypes.AlphaPlane;
  trimap: EnhancementPixelTypes.Trimap;
  crop: EnhancementPixelTypes.Rect;
}): EnhancementPixelTypes.AlphaPlane {
  assertAlphaPlane(input.predicted);
  assertAlphaPlane(input.prior);
  const data = input.prior.data.slice();
  for (let y = 0; y < input.crop.height; y += 1) {
    for (let x = 0; x < input.crop.width; x += 1) {
      const target = (input.crop.y + y) * input.prior.width + input.crop.x + x;
      const trimap = input.trimap.data[target];
      if (trimap === 128) {
        data[target] = bilinear(
          input.predicted,
          ((x + 0.5) * input.predicted.width) / input.crop.width - 0.5,
          ((y + 0.5) * input.predicted.height) / input.crop.height - 0.5,
        );
      } else if (trimap === 0) data[target] = 0;
      else if (trimap === 255) data[target] = 255;
    }
  }
  return { width: input.prior.width, height: input.prior.height, data };
}

export function deterministicRefinement(
  prior: EnhancementPixelTypes.AlphaPlane,
  trimap: EnhancementPixelTypes.Trimap,
): EnhancementPixelTypes.AlphaPlane {
  assertAlphaPlane(prior);
  const data = prior.data.slice();
  for (let index = 0; index < data.length; index += 1) {
    if (trimap.data[index] === 0) data[index] = 0;
    else if (trimap.data[index] === 255) data[index] = 255;
  }
  return { width: prior.width, height: prior.height, data };
}

export function sameAlphaPlane(
  left: EnhancementPixelTypes.AlphaPlane,
  right: EnhancementPixelTypes.AlphaPlane,
): boolean {
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.data.length === right.data.length &&
    left.data.every((value, index) => value === right.data[index])
  );
}

export function nextMattingAttempt(
  current: MattingAttempt,
  webGpuExecutionFailure: boolean,
): MattingAttempt | null {
  if (current.mode === "maximum") {
    return {
      mode: "balanced",
      path: current.path === "webgpu" && webGpuExecutionFailure ? "wasm" : current.path,
    };
  }
  return current.path === "webgpu" && webGpuExecutionFailure
    ? { mode: "balanced", path: "wasm" }
    : null;
}
