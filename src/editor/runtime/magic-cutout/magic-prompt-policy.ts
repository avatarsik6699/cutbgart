import type { MagicCutoutRuntimeTypes } from "./magic-cutout.types";

export const MAGIC_MODEL_PROMPT_LIMIT = 32;

export type MagicModelPrompt = Readonly<{
  label: 0 | 1;
  point: MagicCutoutRuntimeTypes.Point;
}>;

function promptAt(
  stroke: MagicCutoutRuntimeTypes.Stroke,
  pointIndex: number,
): MagicModelPrompt {
  return {
    label: stroke.mode === "keep" ? 1 : 0,
    point: { ...stroke.points[pointIndex]! },
  };
}

/**
 * Produces a bounded, deterministic prompt set without leaking the full draft into model state.
 * Recent stroke endpoints are reserved first so the latest Keep and Remove intent cannot be lost;
 * the remaining capacity samples the complete stroke history at even source-space intervals.
 */
export function createMagicModelPrompts(
  strokes: readonly MagicCutoutRuntimeTypes.Stroke[],
): readonly MagicModelPrompt[] {
  const points = strokes.flatMap((stroke) =>
    stroke.points.map((_point, pointIndex) => promptAt(stroke, pointIndex)),
  );
  if (points.length <= MAGIC_MODEL_PROMPT_LIMIT) return points;

  const reservedIndexes = new Set<number>();
  for (const mode of ["keep", "remove"] as const) {
    for (let strokeIndex = strokes.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
      const stroke = strokes[strokeIndex];
      if (stroke?.mode !== mode || stroke.points.length === 0) continue;
      let offset = 0;
      for (let index = 0; index < strokeIndex; index += 1) {
        offset += strokes[index]?.points.length ?? 0;
      }
      reservedIndexes.add(offset + stroke.points.length - 1);
      break;
    }
  }

  const targetIndexes = new Set(reservedIndexes);
  const remaining = MAGIC_MODEL_PROMPT_LIMIT - targetIndexes.size;
  for (let slot = 0; slot < remaining; slot += 1) {
    targetIndexes.add(
      Math.round((slot * (points.length - 1)) / Math.max(1, remaining - 1)),
    );
  }
  if (targetIndexes.size < MAGIC_MODEL_PROMPT_LIMIT) {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      targetIndexes.add(index);
      if (targetIndexes.size === MAGIC_MODEL_PROMPT_LIMIT) break;
    }
  }

  return [...targetIndexes]
    .sort((left, right) => left - right)
    .slice(-MAGIC_MODEL_PROMPT_LIMIT)
    .map((index) => points[index]!);
}
