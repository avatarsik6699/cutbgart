import type { AlphaMatte } from "./types";

export type BrushMode = "add" | "erase" | "restore";

export interface BrushStroke {
  /** Source-image pixel coordinates. */
  points: { x: number; y: number }[];
  /** Brush size, source-image pixels. */
  radius: number;
  /** 0 (fully soft falloff from center to edge) – 1 (hard edge). */
  hardness: number;
  mode: BrushMode;
}

export interface BrushBoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * The pixel rectangle a stamp centered at `center` with `radius` can touch,
 * clamped to `[0, width) x [0, height)`. Shared by every stamping function
 * below (and by `MaskCorrectionCanvas`'s dirty-rect repaint, since a stroke
 * only ever needs to redraw what a stamp could have touched) so the geometry
 * never drifts between call sites. Returns `null` when there's nothing to
 * touch (non-positive radius, or the stamp falls entirely outside the image).
 */
export function brushBoundingBox(
  center: { x: number; y: number },
  radius: number,
  width: number,
  height: number,
): BrushBoundingBox | null {
  if (radius <= 0) return null;
  const minX = Math.max(0, Math.floor(center.x - radius));
  const maxX = Math.min(width - 1, Math.ceil(center.x + radius));
  const minY = Math.max(0, Math.floor(center.y - radius));
  const maxY = Math.min(height - 1, Math.ceil(center.y + radius));
  if (minX > maxX || minY > maxY) return null;
  return { minX, maxX, minY, maxY };
}

/**
 * One committed brush gesture as a delta: the alpha bytes of `box` before and
 * after the stroke, nothing else. Undo/redo history stores these instead of
 * full `AlphaMatte` snapshots — O(stroke area) memory per step rather than
 * O(image size) — and, just as importantly, patches never flow through React
 * props as multi-megabyte buffers (see docs/KNOWN_GOTCHAS.md: React 19.2's
 * dev-only Performance Track deep-diffs changed props, enumerating large
 * typed arrays element-by-element — the actual cause of Phase 07's ~1-2s
 * pointer-up freeze).
 */
export interface MaskPatch {
  box: BrushBoundingBox;
  /** Alpha of `box`, row-major, box-sized, as it was before the gesture. */
  before: Uint8ClampedArray;
  /** Alpha of `box` after the gesture. */
  after: Uint8ClampedArray;
}

/** Smallest box containing both inputs — accumulates a gesture's dirty rect. */
export function unionBoundingBox(
  a: BrushBoundingBox | null,
  b: BrushBoundingBox | null,
): BrushBoundingBox | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * Copies the alpha channel of `box` out of an RGBA buffer into a tightly
 * packed row-major region buffer — O(box), not O(image).
 */
export function extractAlphaRegion(
  rgba: Uint8ClampedArray,
  imageWidth: number,
  box: BrushBoundingBox,
): Uint8ClampedArray {
  const boxWidth = box.maxX - box.minX + 1;
  const boxHeight = box.maxY - box.minY + 1;
  const region = new Uint8ClampedArray(boxWidth * boxHeight);
  for (let y = 0; y < boxHeight; y++) {
    const rowStart = (box.minY + y) * imageWidth + box.minX;
    for (let x = 0; x < boxWidth; x++) {
      region[y * boxWidth + x] = rgba[(rowStart + x) * 4 + 3] ?? 0;
    }
  }
  return region;
}

/**
 * Writes a tightly packed region buffer (as produced by `extractAlphaRegion`)
 * back into the alpha channel of an RGBA buffer — O(box), not O(image).
 */
export function writeAlphaRegion(
  rgba: Uint8ClampedArray,
  imageWidth: number,
  box: BrushBoundingBox,
  alpha: Uint8ClampedArray,
): void {
  const boxWidth = box.maxX - box.minX + 1;
  const boxHeight = box.maxY - box.minY + 1;
  if (alpha.length !== boxWidth * boxHeight) {
    throw new Error(
      `writeAlphaRegion: region buffer size (${String(alpha.length)}) does not match box dimensions (${String(boxWidth)}x${String(boxHeight)})`,
    );
  }
  for (let y = 0; y < boxHeight; y++) {
    const rowStart = (box.minY + y) * imageWidth + box.minX;
    for (let x = 0; x < boxWidth; x++) {
      rgba[(rowStart + x) * 4 + 3] = alpha[y * boxWidth + x] ?? 0;
    }
  }
}

/**
 * `t` is the normalized distance from the stamp center (0 at center, 1 at the
 * brush edge). `hardness` is the fraction of the radius that stays at full
 * strength before the falloff to 0 begins.
 */
function brushInfluence(t: number, hardness: number): number {
  if (t <= hardness) return 1;
  if (t >= 1) return 0;
  return 1 - (t - hardness) / (1 - hardness);
}

function stampBrush(
  data: Uint8ClampedArray,
  originalData: Uint8ClampedArray,
  width: number,
  height: number,
  center: { x: number; y: number },
  radius: number,
  hardness: number,
  mode: BrushMode,
): void {
  const box = brushBoundingBox(center, radius, width, height);
  if (!box) return;
  const radiusSquared = radius * radius;

  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > radiusSquared) continue;

      const influence = brushInfluence(Math.sqrt(distanceSquared) / radius, hardness);
      if (influence <= 0) continue;

      const index = y * width + x;
      const current = data[index] ?? 0;
      const target =
        mode === "add" ? 255 : mode === "erase" ? 0 : (originalData[index] ?? 0);
      data[index] = current + (target - current) * influence;
    }
  }
}

/**
 * Applies one brush stroke to a working copy of `matte.data`. `restore` mode
 * reads back from `original` (the pristine, pre-correction matte produced by
 * inference) pixel-by-pixel rather than clearing to 0/255 — so restoring
 * never overshoots past what the model actually produced there.
 *
 * Pure — no canvas/DOM dependency, unit-testable in isolation (SPEC.md §7.7).
 * This is the reference implementation; `MaskCorrectionCanvas`'s live-paint
 * path uses `stampBrushAlphaInPlace` below instead, for performance (see its
 * doc comment) — both share the same `brushBoundingBox`/`brushInfluence`
 * geometry so their output never diverges.
 */
export function applyBrushStroke(
  matte: AlphaMatte,
  original: AlphaMatte,
  stroke: BrushStroke,
): AlphaMatte {
  if (matte.width !== original.width || matte.height !== original.height) {
    throw new Error(
      `applyBrushStroke: matte (${String(matte.width)}x${String(matte.height)}) and original (${String(original.width)}x${String(original.height)}) dimensions must match`,
    );
  }

  const { width, height } = matte;
  const data = new Uint8ClampedArray(matte.data);
  const radius = Math.max(stroke.radius, 0);
  const hardness = Math.min(Math.max(stroke.hardness, 0), 1);

  for (const point of stroke.points) {
    stampBrush(data, original.data, width, height, point, radius, hardness, stroke.mode);
  }

  return { width, height, data };
}

/**
 * Same brush math as `stampBrush`, but mutates the alpha byte (index*4+3) of
 * an RGBA buffer directly in place, and returns the touched bounding box
 * instead of a new object. `MaskCorrectionCanvas` uses this for its live
 * per-pointer-move preview: cloning/looping over the *entire* image on every
 * mouse-move point (as `applyBrushStroke` does, by design, for its pure/
 * immutable contract) is O(image size) per point regardless of brush size,
 * which is what caused visible stutter while dragging on real-sized images
 * (Phase 07 Architect Review Notes R3) — mutating in place and only
 * repainting the returned bounding box is O(brush size) per point instead.
 */
export function stampBrushAlphaInPlace(
  rgba: Uint8ClampedArray,
  originalAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  center: { x: number; y: number },
  radius: number,
  hardness: number,
  mode: BrushMode,
): BrushBoundingBox | null {
  const box = brushBoundingBox(center, radius, width, height);
  if (!box) return null;
  const radiusSquared = radius * radius;
  const clampedHardness = Math.min(Math.max(hardness, 0), 1);

  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > radiusSquared) continue;

      const influence = brushInfluence(
        Math.sqrt(distanceSquared) / radius,
        clampedHardness,
      );
      if (influence <= 0) continue;

      const pixelIndex = y * width + x;
      const alphaIndex = pixelIndex * 4 + 3;
      const current = rgba[alphaIndex] ?? 0;
      const target =
        mode === "add" ? 255 : mode === "erase" ? 0 : (originalAlpha[pixelIndex] ?? 0);
      rgba[alphaIndex] = current + (target - current) * influence;
    }
  }

  return box;
}
