import type {
  AlphaMatte,
  PixelRect,
  RefinementConstraintMap,
  Trimap,
} from "../../../entities/processed-image";

interface BuildTrimapInput {
  automaticMatte: AlphaMatte;
  guidedMatte?: AlphaMatte | null;
  constraints?: RefinementConstraintMap | null;
  unknownRadius?: number;
}

function assertMatte(matte: AlphaMatte, width: number, height: number): void {
  if (
    matte.width !== width ||
    matte.height !== height ||
    matte.data.length !== width * height
  ) {
    throw new Error("Matte dimensions do not match the source image");
  }
}

function unknownBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): PixelRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX < 0
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function dilate(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  let current = mask;
  for (let pass = 0; pass < radius; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (current[index]) continue;
        for (let offsetY = -1; offsetY <= 1 && !next[index]; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;
            if (current[sampleY * width + sampleX]) {
              next[index] = 1;
              break;
            }
          }
        }
      }
    }
    current = next;
  }
  return current;
}

export function buildRefinementTrimap({
  automaticMatte,
  guidedMatte = null,
  constraints = null,
  unknownRadius,
}: BuildTrimapInput): Trimap {
  const { width, height } = automaticMatte;
  assertMatte(automaticMatte, width, height);
  if (guidedMatte) assertMatte(guidedMatte, width, height);
  if (
    constraints &&
    (constraints.width !== width ||
      constraints.height !== height ||
      constraints.data.length !== width * height)
  ) {
    throw new Error("Constraint dimensions do not match the source image");
  }

  const low = 16;
  const high = 239;
  const uncertain = new Uint8Array(width * height);
  const classify = (value: number) => (value <= low ? 0 : value >= high ? 2 : 1);
  for (let index = 0; index < uncertain.length; index += 1) {
    const automatic = automaticMatte.data[index] ?? 0;
    const guided = guidedMatte?.data[index] ?? automatic;
    if (
      classify(automatic) === 1 ||
      classify(guided) === 1 ||
      Math.abs(automatic - guided) >= 32
    ) {
      uncertain[index] = 1;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = guidedMatte?.data[index] ?? automaticMatte.data[index] ?? 0;
      const currentClass = classify(value);
      for (const [offsetX, offsetY] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const sampleX = x + offsetX;
        const sampleY = y + offsetY;
        if (sampleX >= width || sampleY >= height) continue;
        const sampleIndex = sampleY * width + sampleX;
        const sampleValue =
          guidedMatte?.data[sampleIndex] ?? automaticMatte.data[sampleIndex] ?? 0;
        if (Math.abs(currentClass - classify(sampleValue)) >= 2) {
          uncertain[index] = 1;
          uncertain[sampleIndex] = 1;
        }
      }
    }
  }

  const adaptiveRadius =
    unknownRadius ?? Math.max(1, Math.min(8, Math.round(Math.min(width, height) / 192)));
  const expanded = dilate(uncertain, width, height, adaptiveRadius);
  const data = new Uint8ClampedArray(width * height);
  for (let index = 0; index < data.length; index += 1) {
    const value = guidedMatte?.data[index] ?? automaticMatte.data[index] ?? 0;
    data[index] = expanded[index] ? 128 : value >= 128 ? 255 : 0;
    const constraint = constraints?.data[index] ?? -1;
    if (constraint === 0) {
      data[index] = 0;
      expanded[index] = 0;
    } else if (constraint === 1) {
      data[index] = 255;
      expanded[index] = 0;
    }
  }

  return { width, height, data, unknownBounds: unknownBounds(expanded, width, height) };
}
