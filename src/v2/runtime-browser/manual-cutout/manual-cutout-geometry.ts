import type { ManualCutoutBox, ManualCutoutPoint } from "./manual-cutout.types";

export function brushBox(
  point: ManualCutoutPoint,
  radius: number,
  width: number,
  height: number,
): ManualCutoutBox | null {
  if (radius <= 0 || width <= 0 || height <= 0) return null;
  const box = {
    minX: Math.max(0, Math.floor(point.x - radius)),
    minY: Math.max(0, Math.floor(point.y - radius)),
    maxX: Math.min(width - 1, Math.ceil(point.x + radius)),
    maxY: Math.min(height - 1, Math.ceil(point.y + radius)),
  };
  return box.minX <= box.maxX && box.minY <= box.maxY ? box : null;
}

export function unionBox(
  left: ManualCutoutBox | null,
  right: ManualCutoutBox | null,
): ManualCutoutBox | null {
  if (left === null) return right;
  if (right === null) return left;
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
  };
}

export function interpolatePoints(
  from: ManualCutoutPoint,
  to: ManualCutoutPoint,
  radius: number,
): readonly ManualCutoutPoint[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.5)));
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };
  });
}
