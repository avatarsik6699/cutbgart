import type { AlphaMatte } from "../../../entities/processed-image";
import { semanticStrokeToPatch } from "./semantic-stroke";
import type { GuidedBox, ObjectMaskLayer } from "./types";

function assertDimensions(matte: AlphaMatte, width: number, height: number): void {
  if (
    matte.width !== width ||
    matte.height !== height ||
    matte.data.length !== width * height
  )
    throw new Error("Guided matte dimensions do not match the source image");
}

export function unionAcceptedLayerMasks(
  layers: readonly ObjectMaskLayer[],
  width: number,
  height: number,
): AlphaMatte | null {
  const accepted = layers.flatMap((layer) =>
    layer.acceptedMatte ? [layer.acceptedMatte] : [],
  );
  if (!accepted.length) return null;
  const data = new Uint8ClampedArray(width * height);
  for (const matte of accepted) {
    assertDimensions(matte, width, height);
    for (let index = 0; index < data.length; index += 1)
      data[index] = Math.max(data[index]!, matte.data[index]!);
  }
  return { width, height, data };
}

function normalizedBoxToPixels(box: GuidedBox, width: number, height: number) {
  return {
    minX: Math.max(0, Math.floor(Math.min(box.xMin, box.xMax) * width)),
    minY: Math.max(0, Math.floor(Math.min(box.yMin, box.yMax) * height)),
    maxX: Math.min(width - 1, Math.ceil(Math.max(box.xMin, box.xMax) * width) - 1),
    maxY: Math.min(height - 1, Math.ceil(Math.max(box.yMin, box.yMax) * height) - 1),
  };
}

export interface GuidedFusionInput {
  baseMatte: AlphaMatte | null;
  layers: readonly ObjectMaskLayer[];
  width: number;
  height: number;
  localUpdate?: { matte: AlphaMatte; region: GuidedBox } | null;
}

interface PixelBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function layerIntentRegions(
  layer: ObjectMaskLayer,
  width: number,
  height: number,
): PixelBox[] {
  const regions: PixelBox[] = [];
  if (layer.targetBox)
    regions.push(normalizedBoxToPixels(layer.targetBox, width, height));
  const pointRadius = Math.max(2, Math.round(Math.max(width, height) * 0.05));
  for (const point of layer.points) {
    const x = Math.round(point.x * (width - 1));
    const y = Math.round(point.y * (height - 1));
    regions.push({
      minX: Math.max(0, x - pointRadius),
      minY: Math.max(0, y - pointRadius),
      maxX: Math.min(width - 1, x + pointRadius),
      maxY: Math.min(height - 1, y + pointRadius),
    });
  }
  for (const stroke of layer.strokes) {
    const patch = semanticStrokeToPatch(stroke, width, height);
    if (patch) regions.push(patch.box);
  }
  if (layer.acceptedMatte) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let index = 0; index < layer.acceptedMatte.data.length; index += 1) {
      if (!layer.acceptedMatte.data[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (maxX >= 0)
      regions.push({
        minX: Math.max(0, minX - 2),
        minY: Math.max(0, minY - 2),
        maxX: Math.min(width - 1, maxX + 2),
        maxY: Math.min(height - 1, maxY + 2),
      });
  }
  return regions;
}

export function fuseGuidedMattes({
  baseMatte,
  layers,
  width,
  height,
  localUpdate,
}: GuidedFusionInput): AlphaMatte {
  if (baseMatte) assertDimensions(baseMatte, width, height);
  const data = baseMatte?.data.slice() ?? new Uint8ClampedArray(width * height);
  const union = unionAcceptedLayerMasks(layers, width, height);
  if (union) {
    const regions = layers.flatMap((layer) => layerIntentRegions(layer, width, height));
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (
          !baseMatte ||
          regions.some(
            (box) => x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY,
          )
        )
          data[index] = union.data[index]!;
      }
  }
  if (localUpdate) {
    assertDimensions(localUpdate.matte, width, height);
    const box = normalizedBoxToPixels(localUpdate.region, width, height);
    for (let y = box.minY; y <= box.maxY; y += 1)
      for (let x = box.minX; x <= box.maxX; x += 1) {
        const index = y * width + x;
        data[index] = localUpdate.matte.data[index]!;
      }
  }
  // Constraints apply last; on overlap, the most recently appended stroke wins.
  for (const layer of layers)
    for (const stroke of layer.strokes) {
      const patch = semanticStrokeToPatch(stroke, width, height);
      if (!patch) continue;
      const patchWidth = patch.box.maxX - patch.box.minX + 1;
      for (let y = patch.box.minY; y <= patch.box.maxY; y += 1)
        for (let x = patch.box.minX; x <= patch.box.maxX; x += 1) {
          const patchIndex = (y - patch.box.minY) * patchWidth + x - patch.box.minX;
          if (patch.coverage[patchIndex])
            data[y * width + x] = patch.mode === "keep" ? 255 : 0;
        }
    }
  return { width, height, data };
}
