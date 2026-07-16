import type { AlphaMatte } from "../../../entities/processed-image";
import type { GuidedBox, GuidedMaskCandidate, GuidedPoint } from "./types";

export interface DisplayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function displayPointToNormalized(
  clientX: number,
  clientY: number,
  rect: DisplayRect,
): { x: number; y: number } {
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
}

export function normalizedPointToPixels(
  point: Pick<GuidedPoint, "x" | "y" | "label">,
  width: number,
  height: number,
): { x: number; y: number; label: 0 | 1 } {
  return { x: point.x * width, y: point.y * height, label: point.label };
}

export function normalizedBoxToPixels(
  box: GuidedBox,
  width: number,
  height: number,
): GuidedBox {
  return {
    xMin: Math.min(box.xMin, box.xMax) * width,
    yMin: Math.min(box.yMin, box.yMax) * height,
    xMax: Math.max(box.xMin, box.xMax) * width,
    yMax: Math.max(box.yMin, box.yMax) * height,
  };
}

export function maskCandidates(
  masks: ArrayLike<number>,
  scores: ArrayLike<number>,
  width: number,
  height: number,
  revision: number,
): GuidedMaskCandidate[] {
  const pixels = width * height;
  const candidates = Array.from(
    { length: Math.min(scores.length, Math.floor(masks.length / pixels)) },
    (_, index) => {
      const data = new Uint8ClampedArray(pixels);
      for (let pixel = 0; pixel < pixels; pixel += 1)
        data[pixel] = (masks[index * pixels + pixel] ?? 0) > 0 ? 255 : 0;
      const rawScore = scores[index];
      return {
        id: `candidate-${String(revision)}-${String(index)}`,
        matte: { width, height, data } satisfies AlphaMatte,
        score:
          typeof rawScore === "number" &&
          Number.isFinite(rawScore) &&
          rawScore >= 0 &&
          rawScore <= 1
            ? rawScore
            : null,
        differenceRatio: 0,
      };
    },
  ).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  const recommended = candidates[0]?.matte.data;
  if (!recommended) return candidates;
  return candidates.map((candidate) => {
    let differentPixels = 0;
    for (let index = 0; index < pixels; index += 1)
      if (candidate.matte.data[index] !== recommended[index]) differentPixels += 1;
    return { ...candidate, differenceRatio: differentPixels / pixels };
  });
}
