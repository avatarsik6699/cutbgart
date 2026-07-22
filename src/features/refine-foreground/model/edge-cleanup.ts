import type {
  AlphaMatte,
  RefinementConstraintMap,
} from "../../../entities/processed-image";

const SOFT_COMPONENT_ALPHA_LIMIT = 96;

function assertCompatible(
  matte: AlphaMatte,
  constraints: RefinementConstraintMap | null,
): void {
  const pixelCount = matte.width * matte.height;
  if (matte.data.length !== pixelCount) {
    throw new Error("Foreground cleanup matte dimensions do not match its data");
  }
  if (
    constraints &&
    (constraints.width !== matte.width ||
      constraints.height !== matte.height ||
      constraints.data.length !== pixelCount)
  ) {
    throw new Error("Foreground cleanup constraint dimensions must match the matte");
  }
}

/**
 * Removes only tiny, low-opacity islands. Opaque or constrained components are
 * retained, so a legitimate disconnected object or small high-confidence
 * target cannot disappear through this optional cleanup.
 */
export function cleanupIsolatedSoftComponents({
  matte,
  constraints = null,
  enabled = true,
  maxPixels = Math.max(4, Math.min(24, Math.floor(matte.data.length / 4096))),
}: {
  matte: AlphaMatte;
  constraints?: RefinementConstraintMap | null;
  enabled?: boolean;
  maxPixels?: number;
}): AlphaMatte {
  assertCompatible(matte, constraints);
  const data = matte.data.slice();
  const visited = new Uint8Array(data.length);
  for (let start = 0; enabled && maxPixels >= 1 && start < data.length; start += 1) {
    const startAlpha = data[start] ?? 0;
    if (visited[start] === 1 || startAlpha === 0) continue;

    const component = [start];
    visited[start] = 1;
    let maximumAlpha = startAlpha;
    let protectedComponent = (constraints?.data[start] ?? -1) !== -1;

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
        if ((constraints?.data[neighbour] ?? -1) !== -1) protectedComponent = true;
      }
    }

    if (
      component.length <= maxPixels &&
      maximumAlpha < SOFT_COMPONENT_ALPHA_LIMIT &&
      !protectedComponent
    ) {
      for (const index of component) data[index] = 0;
    }
  }

  for (let index = 0; index < data.length; index += 1) {
    const constraint = constraints?.data[index] ?? -1;
    if (constraint === 0) data[index] = 0;
    else if (constraint === 1) data[index] = 255;
  }
  return { width: matte.width, height: matte.height, data };
}
