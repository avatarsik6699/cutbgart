import type { MagicCutoutRuntimeTypes } from "./magic-cutout.types";
import type { TransferableMagicCandidate } from "./magic-worker-protocol";

export type MagicConstraintMaps = Readonly<{
  hard: Int8Array;
  hardIndices: readonly number[];
  influence: Int8Array;
  influenceIndices: readonly number[];
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
  stroke: MagicCutoutRuntimeTypes.Stroke,
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
  strokes: readonly MagicCutoutRuntimeTypes.Stroke[],
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
  const hardIndices: number[] = [];
  const influenceIndices: number[] = [];
  for (let index = 0; index < hard.length; index += 1) {
    if ((hard[index] ?? -1) >= 0) hardIndices.push(index);
    if ((influence[index] ?? -1) >= 0) influenceIndices.push(index);
  }
  return { hard, hardIndices, influence, influenceIndices, width, height };
}

function agreement(
  data: Uint8ClampedArray,
  constraints: Int8Array,
  indices: readonly number[],
): number {
  let agreed = 0;
  for (const index of indices) {
    const intent = constraints[index] ?? -1;
    const included = (data[index] ?? 0) >= 128;
    if ((intent === 1 && included) || (intent === 0 && !included)) agreed += 1;
  }
  return indices.length === 0 ? 0 : agreed / indices.length;
}

function continuity(
  candidate: Uint8ClampedArray,
  base: Uint8ClampedArray | null,
  constraints: MagicConstraintMaps,
): number {
  if (base === null) return 0;
  let delta = 0;
  for (const index of constraints.influenceIndices) {
    const intent = constraints.influence[index] ?? -1;
    const baseAlpha = base[index] ?? 0;
    const candidateAlpha = candidate[index] ?? 0;
    const fused = directionalAlpha(intent, baseAlpha, candidateAlpha);
    delta += Math.abs(fused - baseAlpha);
  }
  return constraints.influenceIndices.length === 0
    ? 0
    : 1 - delta / (constraints.influenceIndices.length * 255);
}

function directionalAlpha(intent: number, base: number, candidate: number): number {
  if (intent === 1) return Math.max(base, candidate);
  if (intent === 0) return Math.min(base, candidate);
  return base;
}

function hardAlpha(intent: number, current: number): number {
  if (intent === 1) return 255;
  if (intent === 0) return 0;
  return current;
}

function fuseAutomaticBase(
  candidate: Uint8ClampedArray,
  base: Uint8ClampedArray,
  constraints: MagicConstraintMaps,
): Uint8ClampedArray {
  const data = base.slice();
  for (const index of constraints.influenceIndices) {
    const intent = constraints.influence[index] ?? -1;
    data[index] = directionalAlpha(intent, base[index] ?? 0, candidate[index] ?? 0);
  }
  return data;
}

function fuseDirectGuidance(
  candidate: Uint8ClampedArray,
  constraints: MagicConstraintMaps,
): Uint8ClampedArray {
  const data = candidate.slice();
  for (const index of constraints.hardIndices) {
    const intent = constraints.hard[index] ?? -1;
    data[index] = hardAlpha(intent, data[index] ?? 0);
  }
  return data;
}

function fuse(
  candidate: Uint8ClampedArray,
  base: Uint8ClampedArray | null,
  constraints: MagicConstraintMaps,
): Uint8ClampedArray {
  return base === null
    ? fuseDirectGuidance(candidate, constraints)
    : fuseAutomaticBase(candidate, base, constraints);
}

export function rankAndFuseMagicCandidates(options: {
  base: Uint8ClampedArray | null;
  candidates: readonly TransferableMagicCandidate[];
  strokes: readonly MagicCutoutRuntimeTypes.Stroke[];
}): readonly RankedMagicCandidate[] {
  const first = options.candidates[0];
  if (first === undefined) return [];
  const pixelCount = first.width * first.height;
  if (options.base !== null && options.base.length !== pixelCount) {
    throw new Error("Magic base matte dimensions do not match candidates");
  }
  const constraints = createMagicConstraints(options.strokes, first.width, first.height);
  const best = options.candidates
    .map((candidate, originalIndex) => {
      if (
        candidate.width !== first.width ||
        candidate.height !== first.height ||
        candidate.data.byteLength !== pixelCount
      ) {
        throw new Error("Magic candidate dimensions do not match");
      }
      const raw = new Uint8ClampedArray(candidate.data);
      return {
        raw,
        height: candidate.height,
        modelScore: Number.isFinite(candidate.score) ? candidate.score : 0,
        intentScore: agreement(raw, constraints.hard, constraints.hardIndices),
        continuity: continuity(raw, options.base, constraints),
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
    .at(0);
  if (best === undefined) return [];
  return [
    {
      data: fuse(best.raw, options.base, constraints),
      height: best.height,
      score: best.modelScore,
      width: best.width,
    },
  ];
}
