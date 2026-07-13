import type { AlphaMatte } from "../../../entities/processed-image";
import type { SelectionPrompt } from "./types";

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

export function normalizedPromptToPixels(
  prompt: SelectionPrompt,
  width: number,
  height: number,
): SelectionPrompt {
  if (prompt.type === "point") {
    return { type: "point", x: prompt.x * width, y: prompt.y * height, label: 1 };
  }
  return {
    type: "box",
    xMin: Math.min(prompt.xMin, prompt.xMax) * width,
    yMin: Math.min(prompt.yMin, prompt.yMax) * height,
    xMax: Math.max(prompt.xMin, prompt.xMax) * width,
    yMax: Math.max(prompt.yMin, prompt.yMax) * height,
  };
}

export function bestIouMatte(
  masks: ArrayLike<number>,
  scores: ArrayLike<number>,
  width: number,
  height: number,
): AlphaMatte {
  let best = 0;
  for (let index = 1; index < scores.length; index++) {
    if ((scores[index] ?? -Infinity) > (scores[best] ?? -Infinity)) best = index;
  }
  const pixels = width * height;
  const offset = best * pixels;
  const data = new Uint8ClampedArray(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) {
    data[pixel] = (masks[offset + pixel] ?? 0) > 0 ? 255 : 0;
  }
  return { width, height, data };
}
