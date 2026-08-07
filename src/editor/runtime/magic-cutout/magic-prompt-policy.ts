import type { MagicCutoutRuntimeTypes } from "./magic-cutout.types";

export const MAGIC_MODEL_PROMPT_LIMIT = 32;

export type MagicModelPrompt = Readonly<{
  label: 0 | 1;
  point: MagicCutoutRuntimeTypes.Point;
}>;

function promptAt(
  mode: MagicCutoutRuntimeTypes.Stroke["mode"],
  point: MagicCutoutRuntimeTypes.Point,
): MagicModelPrompt {
  return {
    label: mode === "keep" ? 1 : 0,
    point,
  };
}

type OrderedPrompt = MagicModelPrompt & { order: number };

function sourceCentrelinePrompts(
  strokes: readonly MagicCutoutRuntimeTypes.Stroke[],
): readonly OrderedPrompt[] {
  const latestByPixel = new Map<string, OrderedPrompt>();
  let order = 0;
  for (const stroke of strokes) {
    for (let index = 0; index < stroke.points.length; index += 1) {
      const from = stroke.points[Math.max(0, index - 1)]!;
      const to = stroke.points[index]!;
      const fromX = Math.round(from.x);
      const fromY = Math.round(from.y);
      const toX = Math.round(to.x);
      const toY = Math.round(to.y);
      const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY), 1);
      for (let step = 0; step <= steps; step += 1) {
        const point = {
          x: Math.round(fromX + ((toX - fromX) * step) / steps),
          y: Math.round(fromY + ((toY - fromY) * step) / steps),
        };
        latestByPixel.set(`${String(point.x)}:${String(point.y)}`, {
          ...promptAt(stroke.mode, point),
          order: order++,
        });
      }
    }
  }
  return [...latestByPixel.values()].sort((left, right) => left.order - right.order);
}

function allocatePromptCounts(
  keepAvailable: number,
  removeAvailable: number,
): Readonly<{ keep: number; remove: number }> {
  if (keepAvailable === 0)
    return { keep: 0, remove: Math.min(removeAvailable, MAGIC_MODEL_PROMPT_LIMIT) };
  if (removeAvailable === 0)
    return { keep: Math.min(keepAvailable, MAGIC_MODEL_PROMPT_LIMIT), remove: 0 };
  let keep = Math.min(keepAvailable, Math.ceil(MAGIC_MODEL_PROMPT_LIMIT / 2));
  let remove = Math.min(removeAvailable, Math.floor(MAGIC_MODEL_PROMPT_LIMIT / 2));
  let remaining = MAGIC_MODEL_PROMPT_LIMIT - keep - remove;
  while (remaining > 0 && (keep < keepAvailable || remove < removeAvailable)) {
    if (keep <= remove && keep < keepAvailable) keep += 1;
    else if (remove < removeAvailable) remove += 1;
    else keep += 1;
    remaining -= 1;
  }
  return { keep, remove };
}

function representativePrompts(
  prompts: readonly OrderedPrompt[],
  count: number,
): readonly OrderedPrompt[] {
  if (count <= 0) return [];
  if (prompts.length <= count) return prompts;
  if (count === 1) return [prompts.at(-1)!];
  return Array.from(
    { length: count },
    (_unused, index) =>
      prompts[Math.round((index * (prompts.length - 1)) / (count - 1))]!,
  );
}

/**
 * Produces a bounded prompt set from source-pixel centrelines. Pointer event density cannot
 * consume the budget, both semantic modes receive fair capacity, and later strokes own overlap.
 */
export function createMagicModelPrompts(
  strokes: readonly MagicCutoutRuntimeTypes.Stroke[],
): readonly MagicModelPrompt[] {
  const prompts = sourceCentrelinePrompts(strokes);
  if (prompts.length <= MAGIC_MODEL_PROMPT_LIMIT)
    return prompts.map(({ label, point }) => ({ label, point }));
  const keep = prompts.filter((prompt) => prompt.label === 1);
  const remove = prompts.filter((prompt) => prompt.label === 0);
  const allocation = allocatePromptCounts(keep.length, remove.length);
  return [
    ...representativePrompts(keep, allocation.keep),
    ...representativePrompts(remove, allocation.remove),
  ].map(({ label, point }) => ({ label, point }));
}
