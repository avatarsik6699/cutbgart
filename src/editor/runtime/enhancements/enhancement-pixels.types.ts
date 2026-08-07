export declare namespace EnhancementPixelTypes {
  type AlphaPlane = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };

  type Rect = { x: number; y: number; width: number; height: number };

  type Trimap = AlphaPlane & { unknownBounds: Rect | null };
}
