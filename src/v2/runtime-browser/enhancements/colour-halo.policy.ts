import type { AlphaPlane } from "./enhancement-pixels.types";

const BACKGROUND_ALPHA_LIMIT = 8;
const FOREGROUND_ALPHA_LIMIT = 247;
const SOFT_COMPONENT_ALPHA_LIMIT = 96;
const SAMPLE_RADIUS = 8;

export type ColourHaloResult = {
  rgba: Uint8ClampedArray;
  matte: AlphaPlane;
  changed: boolean;
  actualPath: "decontaminate" | "edge-aware-fallback" | "unchanged";
  fallback: "none" | "no-soft-edge" | "no-background-samples";
};

type ColourSample = { red: number; green: number; blue: number };

function assertMatte(matte: AlphaPlane): void {
  const pixels = matte.width * matte.height;
  if (matte.width <= 0 || matte.height <= 0 || matte.data.length !== pixels) {
    throw new Error("Colour-halo matte dimensions are invalid");
  }
}

function assertInput(rgba: Uint8ClampedArray, matte: AlphaPlane): void {
  assertMatte(matte);
  if (rgba.length !== matte.width * matte.height * 4)
    throw new Error("Colour-halo source and matte dimensions must match");
}

export function cleanupIsolatedSoftComponents(matte: AlphaPlane): AlphaPlane {
  assertMatte(matte);
  const data = matte.data.slice();
  const visited = new Uint8Array(data.length);
  const maxPixels = Math.max(4, Math.min(24, Math.floor(data.length / 4096)));
  for (let start = 0; start < data.length; start += 1) {
    const alpha = data[start] ?? 0;
    if (visited[start] === 1 || alpha === 0) continue;
    const component = [start];
    visited[start] = 1;
    let maximumAlpha = alpha;
    for (let cursor = 0; cursor < component.length; cursor += 1) {
      const index = component[cursor]!;
      const x = index % matte.width;
      const neighbours = [index - matte.width, index + matte.width];
      if (x > 0) neighbours.push(index - 1);
      if (x + 1 < matte.width) neighbours.push(index + 1);
      for (const neighbour of neighbours) {
        if (
          neighbour < 0 ||
          neighbour >= data.length ||
          visited[neighbour] === 1 ||
          (data[neighbour] ?? 0) === 0
        ) {
          continue;
        }
        visited[neighbour] = 1;
        component.push(neighbour);
        maximumAlpha = Math.max(maximumAlpha, data[neighbour] ?? 0);
      }
    }
    if (component.length <= maxPixels && maximumAlpha < SOFT_COMPONENT_ALPHA_LIMIT) {
      for (const index of component) data[index] = 0;
    }
  }
  return { width: matte.width, height: matte.height, data };
}

function sampleNearestClass(
  rgba: Uint8ClampedArray,
  matte: AlphaPlane,
  x: number,
  y: number,
  predicate: (alpha: number) => boolean,
): ColourSample | null {
  for (let radius = 1; radius <= SAMPLE_RADIUS; radius += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(matte.width - 1, x + radius);
    const minY = Math.max(0, y - radius);
    const maxY = Math.min(matte.height - 1, y + radius);
    for (let sampleY = minY; sampleY <= maxY; sampleY += 1) {
      for (let sampleX = minX; sampleX <= maxX; sampleX += 1) {
        if (
          sampleX !== minX &&
          sampleX !== maxX &&
          sampleY !== minY &&
          sampleY !== maxY
        ) {
          continue;
        }
        const index = sampleY * matte.width + sampleX;
        if (!predicate(matte.data[index] ?? 0)) continue;
        red += rgba[index * 4] ?? 0;
        green += rgba[index * 4 + 1] ?? 0;
        blue += rgba[index * 4 + 2] ?? 0;
        count += 1;
      }
    }
    if (count > 0) return { red: red / count, green: green / count, blue: blue / count };
  }
  return null;
}

function decontaminate(composite: number, background: number, alpha: number): number {
  const estimate = (composite - (1 - alpha) * background) / Math.max(alpha, 0.08);
  const amount = Math.min(0.8, (1 - alpha) * 0.75);
  return Math.max(
    0,
    Math.min(255, Math.round(composite + (estimate - composite) * amount)),
  );
}

function fallback(composite: number, foreground: number, alpha: number): number {
  const amount = Math.min(0.45, (1 - alpha) * 0.45);
  return Math.round(composite + (foreground - composite) * amount);
}

export function removeColourHalo(
  rgba: Uint8ClampedArray,
  matte: AlphaPlane,
): ColourHaloResult {
  assertInput(rgba, matte);
  const result = rgba.slice();
  const cleanedMatte = cleanupIsolatedSoftComponents(matte);
  let softPixels = 0;
  let backgroundSamples = 0;
  let fallbackSamples = 0;
  let changed = !cleanedMatte.data.every((value, index) => value === matte.data[index]);
  for (let index = 0; index < cleanedMatte.data.length; index += 1) {
    const alphaByte = cleanedMatte.data[index] ?? 0;
    if (alphaByte === 0 || alphaByte === 255) continue;
    softPixels += 1;
    const x = index % matte.width;
    const y = Math.floor(index / matte.width);
    const alpha = alphaByte / 255;
    const background = sampleNearestClass(
      rgba,
      cleanedMatte,
      x,
      y,
      (sample) => sample <= BACKGROUND_ALPHA_LIMIT,
    );
    const foreground =
      background === null
        ? sampleNearestClass(
            rgba,
            cleanedMatte,
            x,
            y,
            (sample) => sample >= FOREGROUND_ALPHA_LIMIT,
          )
        : null;
    if (background === null && foreground === null) continue;
    if (background === null) fallbackSamples += 1;
    else backgroundSamples += 1;
    const offset = index * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      const before = result[offset + channel] ?? 0;
      const after =
        background === null
          ? fallback(
              before,
              [foreground!.red, foreground!.green, foreground!.blue][channel]!,
              alpha,
            )
          : decontaminate(
              before,
              [background.red, background.green, background.blue][channel]!,
              alpha,
            );
      result[offset + channel] = after;
      if (after !== before) changed = true;
    }
  }
  if (softPixels === 0) {
    return {
      rgba: result,
      matte: cleanedMatte,
      changed,
      actualPath: "unchanged",
      fallback: "no-soft-edge",
    };
  }
  if (backgroundSamples === 0 && fallbackSamples > 0) {
    return {
      rgba: result,
      matte: cleanedMatte,
      changed,
      actualPath: "edge-aware-fallback",
      fallback: "no-background-samples",
    };
  }
  return {
    rgba: result,
    matte: cleanedMatte,
    changed,
    actualPath: changed ? "decontaminate" : "unchanged",
    fallback: changed ? "none" : "no-background-samples",
  };
}
