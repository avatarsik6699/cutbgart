import type { MagicStroke } from "./magic-cutout.types";
import type { TransferableMagicCandidate } from "./magic-worker-protocol";

export type MagicConstraintMaps = Readonly<{
  hard: Int8Array;
  influence: Int8Array;
  width: number;
  height: number;
}>;

export type RankedMagicCandidate = Readonly<{
  data: Uint8ClampedArray;
  height: number;
  score: number;
  width: number;
}>;

const HARD_CORE_RATIO = 0.35;

function stampStroke(
  target: Int8Array,
  stroke: MagicStroke,
  width: number,
  height: number,
  radius: number,
): void {
  const intent = stroke.mode === "keep" ? 1 : 0;
  const stamp = (centerX: number, centerY: number): void => {
    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(height - 1, centerY + radius);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
          target[y * width + x] = intent;
        }
      }
    }
  };
  for (let index = 0; index < stroke.points.length; index += 1) {
    const from = stroke.points[Math.max(0, index - 1)]!;
    const to = stroke.points[index]!;
    const fromX = Math.round(from.x);
    const fromY = Math.round(from.y);
    const toX = Math.round(to.x);
    const toY = Math.round(to.y);
    const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY), 1);
    for (let step = 0; step <= steps; step += 1) {
      stamp(
        Math.round(fromX + ((toX - fromX) * step) / steps),
        Math.round(fromY + ((toY - fromY) * step) / steps),
      );
    }
  }
}

export function createMagicConstraints(
  strokes: readonly MagicStroke[],
  width: number,
  height: number,
): MagicConstraintMaps {
  if (
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    !Number.isSafeInteger(height) ||
    height <= 0
  ) {
    throw new Error("Magic constraint dimensions must be positive integers");
  }
  const hard = new Int8Array(width * height).fill(-1);
  const influence = new Int8Array(width * height).fill(-1);
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const radius = Math.max(1, Math.round(stroke.radius));
    stampStroke(influence, stroke, width, height, radius);
    stampStroke(
      hard,
      stroke,
      width,
      height,
      Math.max(1, Math.round(radius * HARD_CORE_RATIO)),
    );
  }
  return { hard, influence, width, height };
}

function agreement(data: Uint8ClampedArray, constraints: Int8Array): number {
  let marked = 0;
  let agreed = 0;
  constraints.forEach((intent, index) => {
    if (intent < 0) return;
    marked += 1;
    const included = (data[index] ?? 0) >= 128;
    if ((intent === 1 && included) || (intent === 0 && !included)) agreed += 1;
  });
  return marked === 0 ? 0 : agreed / marked;
}

function continuity(
  data: Uint8ClampedArray,
  base: Uint8ClampedArray | null,
  influence: Int8Array,
): number {
  if (base === null) return 0;
  let compared = 0;
  let delta = 0;
  influence.forEach((intent, index) => {
    if (intent < 0) return;
    compared += 1;
    delta += Math.abs((data[index] ?? 0) - (base[index] ?? 0));
  });
  return compared === 0 ? 0 : 1 - delta / (compared * 255);
}

function fuse(
  candidate: Uint8ClampedArray,
  base: Uint8ClampedArray | null,
  constraints: MagicConstraintMaps,
): Uint8ClampedArray {
  const data = base?.slice() ?? candidate.slice();
  if (base !== null) {
    constraints.influence.forEach((intent, index) => {
      if (intent === 1) data[index] = Math.max(base[index] ?? 0, candidate[index] ?? 0);
      else if (intent === 0)
        data[index] = Math.min(base[index] ?? 0, candidate[index] ?? 0);
    });
  }
  constraints.hard.forEach((intent, index) => {
    if (intent === 1) data[index] = 255;
    else if (intent === 0) data[index] = 0;
  });
  return data;
}

export function rankAndFuseMagicCandidates(options: {
  base: Uint8ClampedArray | null;
  candidates: readonly TransferableMagicCandidate[];
  strokes: readonly MagicStroke[];
}): readonly RankedMagicCandidate[] {
  const first = options.candidates[0];
  if (first === undefined) return [];
  const pixelCount = first.width * first.height;
  if (options.base !== null && options.base.length !== pixelCount) {
    throw new Error("Magic base matte dimensions do not match candidates");
  }
  const constraints = createMagicConstraints(options.strokes, first.width, first.height);
  return options.candidates
    .map((candidate, originalIndex) => {
      if (
        candidate.width !== first.width ||
        candidate.height !== first.height ||
        candidate.data.byteLength !== pixelCount
      ) {
        throw new Error("Magic candidate dimensions do not match");
      }
      const raw = new Uint8ClampedArray(candidate.data);
      const intentScore = agreement(raw, constraints.hard);
      const data = fuse(raw, options.base, constraints);
      return {
        data,
        height: candidate.height,
        modelScore: Number.isFinite(candidate.score) ? candidate.score : 0,
        intentScore,
        continuity: continuity(data, options.base, constraints.influence),
        originalIndex,
        width: candidate.width,
      };
    })
    .sort(
      (left, right) =>
        right.intentScore - left.intentScore ||
        right.continuity - left.continuity ||
        right.modelScore - left.modelScore ||
        left.originalIndex - right.originalIndex,
    )
    .slice(0, 3)
    .map(({ data, height, modelScore, width }) => ({
      data,
      height,
      score: modelScore,
      width,
    }));
}
