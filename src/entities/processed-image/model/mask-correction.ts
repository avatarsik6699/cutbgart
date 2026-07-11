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

interface BrushStampRow {
  offsetY: number;
  startX: number;
  influences: Uint8Array;
}

interface BrushStamp {
  radius: number;
  hardness: number;
  rows: BrushStampRow[];
}

const BRUSH_SUBPIXEL_STEPS = 16;
const BRUSH_STAMP_CACHE_LIMIT = 256;
const brushStampCache = new Map<string, BrushStamp>();

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

function brushStampCacheKey(
  radius: number,
  hardness: number,
  subpixelX: number,
  subpixelY: number,
): string {
  return `${radius.toFixed(3)}:${hardness.toFixed(3)}:${subpixelX.toFixed(4)}:${subpixelY.toFixed(4)}`;
}

function getBrushStamp(
  radius: number,
  hardness: number,
  subpixelX: number,
  subpixelY: number,
): BrushStamp | null {
  if (radius <= 0) return null;
  const clampedHardness = Math.min(Math.max(hardness, 0), 1);
  const key = brushStampCacheKey(radius, clampedHardness, subpixelX, subpixelY);
  const cached = brushStampCache.get(key);
  if (cached) return cached;

  const integerRadius = Math.ceil(radius);
  const rows: BrushStampRow[] = [];
  for (let offsetY = -integerRadius; offsetY <= integerRadius; offsetY++) {
    const influences: number[] = [];
    let startX: number | null = null;
    let lastX: number | null = null;

    for (let offsetX = -integerRadius; offsetX <= integerRadius; offsetX++) {
      const dx = offsetX - subpixelX;
      const dy = offsetY - subpixelY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const influence = brushInfluence(distance / radius, clampedHardness);
      if (influence <= 0) continue;

      if (startX === null) startX = offsetX;
      if (lastX !== null && offsetX !== lastX + 1) {
        rows.push({
          offsetY,
          startX,
          influences: Uint8Array.from(influences),
        });
        influences.length = 0;
        startX = offsetX;
      }
      influences.push(Math.round(influence * 255));
      lastX = offsetX;
    }

    if (startX !== null) {
      rows.push({
        offsetY,
        startX,
        influences: Uint8Array.from(influences),
      });
    }
  }

  const stamp = { radius, hardness: clampedHardness, rows };
  brushStampCache.set(key, stamp);
  if (brushStampCache.size > BRUSH_STAMP_CACHE_LIMIT) {
    const oldest = brushStampCache.keys().next().value;
    if (oldest) brushStampCache.delete(oldest);
  }
  return stamp;
}

function stampPlacement(
  center: { x: number; y: number },
  radius: number,
  hardness: number,
): { stamp: BrushStamp; baseX: number; baseY: number } | null {
  const snappedX = Math.round(center.x * BRUSH_SUBPIXEL_STEPS) / BRUSH_SUBPIXEL_STEPS;
  const snappedY = Math.round(center.y * BRUSH_SUBPIXEL_STEPS) / BRUSH_SUBPIXEL_STEPS;
  const baseX = Math.floor(snappedX);
  const baseY = Math.floor(snappedY);
  const subpixelX = snappedX - baseX;
  const subpixelY = snappedY - baseY;
  const stamp = getBrushStamp(radius, hardness, subpixelX, subpixelY);
  if (!stamp) return null;
  return { stamp, baseX, baseY };
}

function applyBrushTarget(
  current: number,
  target: number,
  influenceByte: number,
): number {
  return current + (target - current) * (influenceByte / 255);
}

export function interpolateStrokePoints(
  points: { x: number; y: number }[],
  radius: number,
): { x: number; y: number }[] {
  if (points.length <= 1) return [...points];

  const spacing = Math.max(1, Math.max(radius, 0) * 0.5);
  const interpolated: { x: number; y: number }[] = [points[0]!];

  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      interpolated.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
  }

  return interpolated;
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
): BrushBoundingBox | null {
  const placement = stampPlacement(center, radius, hardness);
  if (!placement) return null;
  const { stamp, baseX, baseY } = placement;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (const row of stamp.rows) {
    const y = baseY + row.offsetY;
    if (y < 0 || y >= height) continue;

    const startX = baseX + row.startX;
    let rowTouched = false;
    let rowMinX = width;
    let rowMaxX = -1;
    for (let offset = 0; offset < row.influences.length; offset++) {
      const x = startX + offset;
      if (x < 0 || x >= width) continue;

      const influence = row.influences[offset] ?? 0;
      if (influence <= 0) continue;

      const index = y * width + x;
      const current = data[index] ?? 0;
      const target =
        mode === "add" ? 255 : mode === "erase" ? 0 : (originalData[index] ?? 0);
      data[index] = applyBrushTarget(current, target, influence);
      rowTouched = true;
      if (x < rowMinX) rowMinX = x;
      if (x > rowMaxX) rowMaxX = x;
    }
    if (rowTouched) {
      if (rowMinX < minX) minX = rowMinX;
      if (rowMaxX > maxX) maxX = rowMaxX;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return minX <= maxX && minY <= maxY ? { minX, maxX, minY, maxY } : null;
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

  for (const point of interpolateStrokePoints(stroke.points, radius)) {
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
  const placement = stampPlacement(center, radius, hardness);
  if (!placement) return null;
  const { stamp, baseX, baseY } = placement;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (const row of stamp.rows) {
    const y = baseY + row.offsetY;
    if (y < 0 || y >= height) continue;

    const startX = baseX + row.startX;
    let rowTouched = false;
    let rowMinX = width;
    let rowMaxX = -1;
    for (let offset = 0; offset < row.influences.length; offset++) {
      const x = startX + offset;
      if (x < 0 || x >= width) continue;

      const influence = row.influences[offset] ?? 0;
      if (influence <= 0) continue;

      const pixelIndex = y * width + x;
      const alphaIndex = pixelIndex * 4 + 3;
      const current = rgba[alphaIndex] ?? 0;
      const target =
        mode === "add" ? 255 : mode === "erase" ? 0 : (originalAlpha[pixelIndex] ?? 0);
      rgba[alphaIndex] = applyBrushTarget(current, target, influence);
      rowTouched = true;
      if (x < rowMinX) rowMinX = x;
      if (x > rowMaxX) rowMaxX = x;
    }
    if (rowTouched) {
      if (rowMinX < minX) minX = rowMinX;
      if (rowMaxX > maxX) maxX = rowMaxX;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return minX <= maxX && minY <= maxY ? { minX, maxX, minY, maxY } : null;
}

export function stampBrushStrokeAlphaInPlace(
  rgba: Uint8ClampedArray,
  originalAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  points: { x: number; y: number }[],
  radius: number,
  hardness: number,
  mode: BrushMode,
): BrushBoundingBox | null {
  let touched: BrushBoundingBox | null = null;
  for (const point of interpolateStrokePoints(points, radius)) {
    touched = unionBoundingBox(
      touched,
      stampBrushAlphaInPlace(
        rgba,
        originalAlpha,
        width,
        height,
        point,
        radius,
        hardness,
        mode,
      ),
    );
  }
  return touched;
}
