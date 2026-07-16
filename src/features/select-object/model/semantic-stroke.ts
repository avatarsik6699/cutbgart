import type { SemanticStroke, SemanticStrokeMode } from "./types";

export const MAX_STROKE_PROMPT_SAMPLES = 32;

export interface ConstraintPatch {
  mode: SemanticStrokeMode;
  box: { minX: number; minY: number; maxX: number; maxY: number };
  coverage: Uint8Array;
}

export function sampleSemanticStroke(
  stroke: SemanticStroke,
  limit = MAX_STROKE_PROMPT_SAMPLES,
): readonly { x: number; y: number }[] {
  if (stroke.points.length <= limit) return stroke.points;
  const result = [];
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round((index * (stroke.points.length - 1)) / (limit - 1));
    result.push(stroke.points[sourceIndex]!);
  }
  return result;
}

export function semanticStrokeToPatch(
  stroke: SemanticStroke,
  width: number,
  height: number,
): ConstraintPatch | null {
  if (!stroke.points.length || width <= 0 || height <= 0) return null;
  const radius = Math.max(1, Math.round(stroke.radius));
  const pixels = stroke.points.map((point) => ({
    x: Math.round(Math.min(1, Math.max(0, point.x)) * (width - 1)),
    y: Math.round(Math.min(1, Math.max(0, point.y)) * (height - 1)),
  }));
  const box = {
    minX: Math.max(0, Math.min(...pixels.map((point) => point.x)) - radius),
    minY: Math.max(0, Math.min(...pixels.map((point) => point.y)) - radius),
    maxX: Math.min(width - 1, Math.max(...pixels.map((point) => point.x)) + radius),
    maxY: Math.min(height - 1, Math.max(...pixels.map((point) => point.y)) + radius),
  };
  const patchWidth = box.maxX - box.minX + 1;
  const coverage = new Uint8Array(patchWidth * (box.maxY - box.minY + 1));
  const stamp = (center: { x: number; y: number }) => {
    for (
      let y = Math.max(box.minY, center.y - radius);
      y <= Math.min(box.maxY, center.y + radius);
      y += 1
    )
      for (
        let x = Math.max(box.minX, center.x - radius);
        x <= Math.min(box.maxX, center.x + radius);
        x += 1
      )
        if ((x - center.x) ** 2 + (y - center.y) ** 2 <= radius ** 2)
          coverage[(y - box.minY) * patchWidth + x - box.minX] = 1;
  };
  for (let index = 0; index < pixels.length; index += 1) {
    const from = pixels[Math.max(0, index - 1)]!;
    const to = pixels[index]!;
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
    for (let step = 0; step <= steps; step += 1)
      stamp({
        x: Math.round(from.x + ((to.x - from.x) * step) / steps),
        y: Math.round(from.y + ((to.y - from.y) * step) / steps),
      });
  }
  return { mode: stroke.mode, box, coverage };
}
