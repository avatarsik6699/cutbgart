export type AlphaPlane = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type PixelRect = { x: number; y: number; width: number; height: number };

export type RefinementTrimap = AlphaPlane & { unknownBounds: PixelRect | null };
