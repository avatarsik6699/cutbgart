import type {
  AlphaMatte,
  PixelRect,
  RefinementConstraintMap,
} from "../../../entities/processed-image";
import type {
  DirtyPixelPatch,
  ForegroundCleanupFallback,
  ForegroundCleanupPath,
} from "./types";
import { cleanupIsolatedSoftComponents } from "./edge-cleanup";

const BACKGROUND_ALPHA_LIMIT = 8;
const FOREGROUND_ALPHA_LIMIT = 247;
const SAMPLE_RADIUS = 8;

interface ColourSample {
  red: number;
  green: number;
  blue: number;
}

export interface ForegroundPixelResult {
  rgba: Uint8ClampedArray;
  matte: AlphaMatte;
  dirtyPatch: DirtyPixelPatch | null;
  actualPath: ForegroundCleanupPath;
  fallback: ForegroundCleanupFallback;
  fallbackReason?: string;
}

function assertInput(
  rgba: Uint8ClampedArray,
  matte: AlphaMatte,
  constraints: RefinementConstraintMap | null,
): void {
  const pixelCount = matte.width * matte.height;
  if (matte.data.length !== pixelCount || rgba.length !== pixelCount * 4) {
    throw new Error("Foreground refinement source and matte dimensions must match");
  }
  if (
    constraints &&
    (constraints.width !== matte.width ||
      constraints.height !== matte.height ||
      constraints.data.length !== pixelCount)
  ) {
    throw new Error("Foreground refinement constraint dimensions must match the matte");
  }
}

function sampleNearestClass(
  rgba: Uint8ClampedArray,
  matte: AlphaMatte,
  x: number,
  y: number,
  predicate: (alpha: number) => boolean,
): ColourSample | null {
  for (let radius = 1; radius <= SAMPLE_RADIUS; radius += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(matte.width - 1, x + radius);
    const minY = Math.max(0, y - radius);
    const maxY = Math.min(matte.height - 1, y + radius);
    for (let sampleY = minY; sampleY <= maxY; sampleY += 1) {
      for (let sampleX = minX; sampleX <= maxX; sampleX += 1) {
        if (
          sampleX !== minX &&
          sampleX !== maxX &&
          sampleY !== minY &&
          sampleY !== maxY
        ) {
          continue;
        }
        const index = sampleY * matte.width + sampleX;
        if (!predicate(matte.data[index] ?? 0)) continue;
        red += rgba[index * 4] ?? 0;
        green += rgba[index * 4 + 1] ?? 0;
        blue += rgba[index * 4 + 2] ?? 0;
        count += 1;
      }
    }
    if (count > 0) {
      return { red: red / count, green: green / count, blue: blue / count };
    }
  }
  return null;
}

function decontaminatedChannel(
  composite: number,
  background: number,
  alpha: number,
): number {
  const stableAlpha = Math.max(alpha, 0.08);
  const estimate = (composite - (1 - alpha) * background) / stableAlpha;
  const conservativeAmount = Math.min(0.8, (1 - alpha) * 0.75);
  return Math.max(
    0,
    Math.min(255, Math.round(composite + (estimate - composite) * conservativeAmount)),
  );
}

function fallbackChannel(composite: number, foreground: number, alpha: number): number {
  const amount = Math.min(0.45, (1 - alpha) * 0.45);
  return Math.round(composite + (foreground - composite) * amount);
}

function patchFromChanges(
  rgba: Uint8ClampedArray,
  changed: readonly number[],
  width: number,
): DirtyPixelPatch | null {
  if (changed.length === 0) return null;
  let minX = width;
  let maxX = 0;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = 0;
  for (const index of changed) {
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const bounds: PixelRect = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  const patch = new Uint8ClampedArray(bounds.width * bounds.height * 4);
  for (let y = 0; y < bounds.height; y += 1) {
    const start = ((bounds.y + y) * width + bounds.x) * 4;
    patch.set(rgba.subarray(start, start + bounds.width * 4), y * bounds.width * 4);
  }
  return { bounds, rgba: patch };
}

/**
 * Estimates foreground RGB at soft alpha edges. The source alpha channel and
 * every definite/constrained pixel remain byte-for-byte unchanged.
 */
export function estimateForegroundPixels({
  rgba,
  matte,
  constraints = null,
  componentCleanup = true,
}: {
  rgba: Uint8ClampedArray;
  matte: AlphaMatte;
  constraints?: RefinementConstraintMap | null;
  componentCleanup?: boolean;
}): ForegroundPixelResult {
  assertInput(rgba, matte, constraints);
  const result = rgba.slice();
  const cleanedMatte = cleanupIsolatedSoftComponents({
    matte,
    constraints,
    enabled: componentCleanup,
  });
  const changed: number[] = [];
  let softPixels = 0;
  let backgroundSamples = 0;
  let fallbackSamples = 0;

  for (let index = 0; index < matte.data.length; index += 1) {
    const alphaByte = cleanedMatte.data[index] ?? 0;
    const constraint = constraints?.data[index] ?? -1;
    if (alphaByte === 0 || alphaByte === 255 || constraint !== -1) continue;
    softPixels += 1;
    const x = index % matte.width;
    const y = Math.floor(index / matte.width);
    const alpha = alphaByte / 255;
    const background = sampleNearestClass(
      rgba,
      cleanedMatte,
      x,
      y,
      (sampleAlpha) => sampleAlpha <= BACKGROUND_ALPHA_LIMIT,
    );
    const foreground = background
      ? null
      : sampleNearestClass(
          rgba,
          cleanedMatte,
          x,
          y,
          (sampleAlpha) => sampleAlpha >= FOREGROUND_ALPHA_LIMIT,
        );
    if (!background && !foreground) continue;
    if (background) backgroundSamples += 1;
    else fallbackSamples += 1;

    const offset = index * 4;
    const beforeRed = result[offset] ?? 0;
    const beforeGreen = result[offset + 1] ?? 0;
    const beforeBlue = result[offset + 2] ?? 0;
    result[offset] = background
      ? decontaminatedChannel(beforeRed, background.red, alpha)
      : fallbackChannel(beforeRed, foreground!.red, alpha);
    result[offset + 1] = background
      ? decontaminatedChannel(beforeGreen, background.green, alpha)
      : fallbackChannel(beforeGreen, foreground!.green, alpha);
    result[offset + 2] = background
      ? decontaminatedChannel(beforeBlue, background.blue, alpha)
      : fallbackChannel(beforeBlue, foreground!.blue, alpha);
    if (
      result[offset] !== beforeRed ||
      result[offset + 1] !== beforeGreen ||
      result[offset + 2] !== beforeBlue
    ) {
      changed.push(index);
    }
  }

  let actualPath: ForegroundCleanupPath = "decontaminate";
  let fallback: ForegroundCleanupFallback = "none";
  let fallbackReason: string | undefined;
  if (softPixels === 0) {
    actualPath = "unchanged";
    fallback = "no-soft-edge";
    fallbackReason = "The matte contains no unconstrained soft-edge pixels.";
  } else if (backgroundSamples === 0 && fallbackSamples > 0) {
    actualPath = "edge-aware-fallback";
    fallback = "no-background-samples";
    fallbackReason = "No nearby definite-background colour samples were available.";
  } else if (changed.length === 0) {
    actualPath = "unchanged";
    fallback = "no-background-samples";
    fallbackReason = "No safe foreground or background colour samples were available.";
  }

  return {
    rgba: result,
    matte: cleanedMatte,
    dirtyPatch: patchFromChanges(result, changed, matte.width),
    actualPath,
    fallback,
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}
