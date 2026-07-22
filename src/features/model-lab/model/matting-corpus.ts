import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import { createEvaluationTrimap } from "./trimap-preparation";
import type { MattingCorpusCase, MattingCorpusCategory } from "./types";

export const SYNTHETIC_MATTING_CATEGORIES = [
  "hair-fur",
  "transparent-thin",
  "holes",
  "shadows",
  "light-on-light",
  "multiple-objects",
  "motion-blur",
  "high-resolution-small-target",
] as const satisfies readonly MattingCorpusCategory[];

const SIZE = 128;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function circleAlpha(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  const distance = Math.hypot(x - cx, y - cy);
  return 1 - smoothstep(radius - 2, radius + 2, distance);
}

export function syntheticAlphaAt(
  category: MattingCorpusCategory,
  x: number,
  y: number,
  size = SIZE,
): number {
  const cx = size / 2;
  const cy = size / 2;
  switch (category) {
    case "hair-fur": {
      const angle = Math.atan2(y - cy, x - cx);
      const radius = size * 0.3 + Math.sin(angle * 23) * size * 0.035;
      return circleAlpha(x, y, cx, cy, radius);
    }
    case "transparent-thin": {
      const line = Math.abs(y - (size * 0.25 + x * 0.48));
      const glass = circleAlpha(x, y, cx, cy, size * 0.27) * 0.48;
      return Math.max(glass, 1 - smoothstep(0.7, 2.4, line));
    }
    case "holes": {
      const outer = circleAlpha(x, y, cx, cy, size * 0.32);
      const inner = circleAlpha(x, y, cx, cy, size * 0.14);
      return outer * (1 - inner);
    }
    case "shadows": {
      const object = circleAlpha(x, y, cx, cy - size * 0.08, size * 0.23);
      const dx = (x - cx) / (size * 0.34);
      const dy = (y - (cy + size * 0.24)) / (size * 0.1);
      const shadow = Math.max(0, 1 - Math.hypot(dx, dy)) * 0.35;
      return Math.max(object, shadow);
    }
    case "light-on-light":
      return circleAlpha(x, y, cx, cy, size * 0.29);
    case "multiple-objects":
      return Math.max(
        circleAlpha(x, y, size * 0.34, cy, size * 0.2),
        circleAlpha(x, y, size * 0.7, cy * 0.92, size * 0.15),
      );
    case "motion-blur": {
      let alpha = 0;
      for (let offset = -12; offset <= 12; offset += 3) {
        alpha = Math.max(
          alpha,
          circleAlpha(x, y, cx + offset, cy, size * 0.2) * (1 - Math.abs(offset) / 18),
        );
      }
      return alpha;
    }
    case "high-resolution-small-target":
      return circleAlpha(x, y, size * 0.68, size * 0.31, size * 0.075);
  }
}

export function buildSyntheticCasePixels(
  category: MattingCorpusCategory,
  size = SIZE,
): { pixels: Uint8ClampedArray; groundTruth: AlphaMatte } {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const alpha = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const amount = syntheticAlphaAt(category, x, y, size);
      alpha[index] = clampByte(amount * 255);
      const background = category === "light-on-light" ? 239 : 226;
      const foreground = category === "light-on-light" ? 250 : 42;
      pixels[index * 4] = clampByte(background * (1 - amount) + foreground * amount);
      pixels[index * 4 + 1] = clampByte(background * (1 - amount) + 112 * amount);
      pixels[index * 4 + 2] = clampByte(background * (1 - amount) + 184 * amount);
      pixels[index * 4 + 3] = 255;
    }
  }
  return { pixels, groundTruth: { width: size, height: size, data: alpha } };
}

async function pixelsToPngBlob(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Synthetic corpus: 2D canvas unavailable");
  const imagePixels = new Uint8ClampedArray(pixels.length);
  imagePixels.set(pixels);
  context.putImageData(new ImageData(imagePixels, width, height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Synthetic corpus: PNG encoding failed"));
    }, "image/png");
  });
}

export async function createSyntheticMattingCorpus(): Promise<MattingCorpusCase[]> {
  const cases: MattingCorpusCase[] = [];
  for (const [index, category] of SYNTHETIC_MATTING_CATEGORIES.entries()) {
    const { pixels, groundTruth } = buildSyntheticCasePixels(category);
    const blob = await pixelsToPngBlob(pixels, groundTruth.width, groundTruth.height);
    const source: SourceImage = {
      blob,
      width: groundTruth.width,
      height: groundTruth.height,
      format: "image/png",
    };
    cases.push({
      ordinal: index + 1,
      category,
      source,
      trimap: createEvaluationTrimap(groundTruth),
      groundTruth,
      sourceUrl: URL.createObjectURL(blob),
    });
  }
  return cases;
}
