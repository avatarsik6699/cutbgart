import type {
  PixelRect,
  RefinementConstraintMap,
} from "../../../entities/processed-image";
import { semanticStrokeToPatch } from "./semantic-stroke";
import type { GuidedBrushMode, GuidedBrushStroke, GuidedPoint } from "./types";

export const MAX_GUIDED_BRUSH_PROMPTS = 32;
export const GUIDED_BRUSH_HARD_CORE_RATIO = 0.35;

export function guidedBrushHardCoreRadius(radius: number): number {
  return Math.max(1, Math.round(radius * GUIDED_BRUSH_HARD_CORE_RATIO));
}

export interface ConsolidatedGuidedBrush {
  constraints: RefinementConstraintMap;
  influenceMask: Uint8Array;
  editRegion: PixelRect | null;
  points: readonly GuidedPoint[];
  keepCount: number;
  removeCount: number;
}

function unionRect(
  current: { minX: number; minY: number; maxX: number; maxY: number } | null,
  next: { minX: number; minY: number; maxX: number; maxY: number },
) {
  if (!current) return { ...next };
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  };
}

function representativeIndices(indices: readonly number[], count: number): number[] {
  if (count <= 0) return [];
  if (indices.length <= count) return [...indices];
  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.min(
      indices.length - 1,
      Math.floor(((index + 0.5) * indices.length) / count),
    );
    return indices[sourceIndex]!;
  });
}

function strokeCentrelineIndices(
  stroke: GuidedBrushStroke,
  width: number,
  height: number,
): number[] {
  const pixels = stroke.points.map((point) => ({
    x: Math.round(Math.min(1, Math.max(0, point.x)) * (width - 1)),
    y: Math.round(Math.min(1, Math.max(0, point.y)) * (height - 1)),
  }));
  const indices: number[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < pixels.length; index += 1) {
    const from = pixels[Math.max(0, index - 1)]!;
    const to = pixels[index]!;
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(from.x + ((to.x - from.x) * step) / steps);
      const y = Math.round(from.y + ((to.y - from.y) * step) / steps);
      const pixelIndex = y * width + x;
      if (!seen.has(pixelIndex)) {
        seen.add(pixelIndex);
        indices.push(pixelIndex);
      }
    }
  }
  return indices;
}

function allocateLabels(
  keepAvailable: number,
  removeAvailable: number,
  limit: number,
): { keep: number; remove: number } {
  if (!keepAvailable) return { keep: 0, remove: Math.min(removeAvailable, limit) };
  if (!removeAvailable) return { keep: Math.min(keepAvailable, limit), remove: 0 };
  let keep = Math.min(keepAvailable, Math.ceil(limit / 2));
  let remove = Math.min(removeAvailable, Math.floor(limit / 2));
  let remaining = limit - keep - remove;
  while (remaining > 0 && (keep < keepAvailable || remove < removeAvailable)) {
    if (keep <= remove && keep < keepAvailable) keep += 1;
    else if (remove < removeAvailable) remove += 1;
    else keep += 1;
    remaining -= 1;
  }
  return { keep, remove };
}

export function consolidateGuidedBrushStrokes(
  strokes: readonly GuidedBrushStroke[],
  width: number,
  height: number,
  limit = MAX_GUIDED_BRUSH_PROMPTS,
): ConsolidatedGuidedBrush {
  if (width <= 0 || height <= 0)
    throw new Error("Guided brush dimensions must be positive");
  const constraints: RefinementConstraintMap = {
    width,
    height,
    data: new Int8Array(width * height).fill(-1),
  };
  const influenceMask = new Uint8Array(width * height);
  let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const stroke of strokes) {
    const patch = semanticStrokeToPatch(
      { ...stroke, radius: guidedBrushHardCoreRadius(stroke.radius) },
      width,
      height,
    );
    if (!patch) continue;
    const patchWidth = patch.box.maxX - patch.box.minX + 1;
    for (let y = patch.box.minY; y <= patch.box.maxY; y += 1)
      for (let x = patch.box.minX; x <= patch.box.maxX; x += 1) {
        const patchIndex = (y - patch.box.minY) * patchWidth + x - patch.box.minX;
        if (patch.coverage[patchIndex])
          constraints.data[y * width + x] = stroke.mode === "keep" ? 1 : 0;
      }
    const influencePatch = semanticStrokeToPatch(stroke, width, height);
    if (!influencePatch) continue;
    bounds = unionRect(bounds, influencePatch.box);
    const influenceWidth = influencePatch.box.maxX - influencePatch.box.minX + 1;
    for (let y = influencePatch.box.minY; y <= influencePatch.box.maxY; y += 1)
      for (let x = influencePatch.box.minX; x <= influencePatch.box.maxX; x += 1) {
        const patchIndex =
          (y - influencePatch.box.minY) * influenceWidth + x - influencePatch.box.minX;
        if (influencePatch.coverage[patchIndex]) influenceMask[y * width + x] = 1;
      }
  }

  const keepPixels: number[] = [];
  const removePixels: number[] = [];
  constraints.data.forEach((value, index) => {
    if (value === 1) keepPixels.push(index);
    else if (value === 0) removePixels.push(index);
  });
  const keepAnchors: number[] = [];
  const removeAnchors: number[] = [];
  const seenKeepAnchors = new Set<number>();
  const seenRemoveAnchors = new Set<number>();
  for (const stroke of strokes) {
    const expectedIntent = stroke.mode === "keep" ? 1 : 0;
    const anchors = strokeCentrelineIndices(stroke, width, height);
    const target = stroke.mode === "keep" ? keepAnchors : removeAnchors;
    const seen = stroke.mode === "keep" ? seenKeepAnchors : seenRemoveAnchors;
    for (const index of anchors) {
      if (constraints.data[index] !== expectedIntent || seen.has(index)) continue;
      seen.add(index);
      target.push(index);
    }
  }
  const allocation = allocateLabels(
    keepAnchors.length,
    removeAnchors.length,
    Math.max(0, Math.min(MAX_GUIDED_BRUSH_PROMPTS, Math.floor(limit))),
  );
  const toPoint = (mode: GuidedBrushMode, index: number, order: number): GuidedPoint => {
    const x = index % width;
    const y = Math.floor(index / width);
    return {
      id: `brush-sample-${mode}-${String(order)}`,
      x: (x + 0.5) / width,
      y: (y + 0.5) / height,
      label: mode === "keep" ? 1 : 0,
    };
  };
  const points = [
    ...representativeIndices(keepAnchors, allocation.keep).map((index, order) =>
      toPoint("keep", index, order),
    ),
    ...representativeIndices(removeAnchors, allocation.remove).map((index, order) =>
      toPoint("remove", index, order),
    ),
  ];
  return {
    constraints,
    influenceMask,
    editRegion: bounds
      ? {
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.maxX - bounds.minX + 1,
          height: bounds.maxY - bounds.minY + 1,
        }
      : null,
    points,
    keepCount: keepPixels.length,
    removeCount: removePixels.length,
  };
}
