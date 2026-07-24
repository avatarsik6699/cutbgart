import type { AlphaMatte } from "../../../entities/processed-image";

export interface FocusCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createEvaluationTrimap(
  groundTruth: AlphaMatte,
  unknownRadius = 3,
): AlphaMatte {
  const data = new Uint8ClampedArray(groundTruth.data.length);
  for (let y = 0; y < groundTruth.height; y += 1) {
    for (let x = 0; x < groundTruth.width; x += 1) {
      let minimum = 255;
      let maximum = 0;
      for (let offsetY = -unknownRadius; offsetY <= unknownRadius; offsetY += 1) {
        for (let offsetX = -unknownRadius; offsetX <= unknownRadius; offsetX += 1) {
          const sampleX = Math.max(0, Math.min(groundTruth.width - 1, x + offsetX));
          const sampleY = Math.max(0, Math.min(groundTruth.height - 1, y + offsetY));
          const value = groundTruth.data[sampleY * groundTruth.width + sampleX] ?? 0;
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        }
      }
      data[y * groundTruth.width + x] = minimum >= 250 ? 255 : maximum <= 5 ? 0 : 128;
    }
  }
  return { width: groundTruth.width, height: groundTruth.height, data };
}

export function computeFocusCrop(trimap: AlphaMatte, padding = 16): FocusCrop {
  let minX = trimap.width;
  let minY = trimap.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < trimap.height; y += 1) {
    for (let x = 0; x < trimap.width; x += 1) {
      if (trimap.data[y * trimap.width + x] !== 128) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: trimap.width, height: trimap.height };
  }
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  return {
    x,
    y,
    width: Math.min(trimap.width, maxX + padding + 1) - x,
    height: Math.min(trimap.height, maxY + padding + 1) - y,
  };
}

export function enforceTrimapConstraints(
  predicted: AlphaMatte,
  trimap: AlphaMatte,
): AlphaMatte {
  if (predicted.width !== trimap.width || predicted.height !== trimap.height) {
    throw new Error("Predicted alpha and trimap dimensions must match");
  }
  const data = predicted.data.slice();
  for (let index = 0; index < data.length; index += 1) {
    if (trimap.data[index] === 0) data[index] = 0;
    if (trimap.data[index] === 255) data[index] = 255;
  }
  return { width: predicted.width, height: predicted.height, data };
}
