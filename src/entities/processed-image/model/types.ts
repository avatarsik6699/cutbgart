/** Explicit production model selected for automatic background removal. */
export type AutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";

/**
 * `fast`/`max` remain accepted at the worker boundary for backwards-compatible
 * sessions and tests. New UI code always emits an `AutomaticModelMode`.
 */
export type QualityMode = AutomaticModelMode | "fast" | "max";

export type InferencePath = "webgpu" | "wasm";

export interface DeviceCapabilities {
  /** Selected once per session via `navigator.gpu.requestAdapter()`. */
  inferencePath: InferencePath;
  /** Downgraded to "fast" on weak devices (SPEC.md §2.2). */
  defaultQualityMode: QualityMode;
}

export interface SourceImage {
  blob: Blob;
  width: number;
  height: number;
  format: "image/jpeg" | "image/png" | "image/webp";
}

export interface AlphaMatte {
  // Single-channel alpha-matte output of the ML model — preserves soft edges
  // (hair/fur/translucent objects), not a binary mask.
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type TrimapValue = 0 | 128 | 255;
export type HardConstraintValue = -1 | 0 | 1;

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Trimap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  unknownBounds: PixelRect | null;
}

export interface RefinementConstraintMap {
  width: number;
  height: number;
  data: Int8Array;
}

export type HexColor = `#${string}`;

export interface BackgroundGradientStop {
  offset: 0 | 1;
  color: HexColor;
}

export type BackgroundFill =
  | { type: "transparent" }
  | { type: "color"; value: HexColor }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      stops: readonly [
        BackgroundGradientStop & { offset: 0 },
        BackgroundGradientStop & { offset: 1 },
      ];
    }
  | { type: "image"; blob: Blob };

export interface ProcessedImage {
  source: SourceImage;
  /** Composited PNG-with-alpha, produced via OffscreenCanvas. */
  result: Blob;
  /** Transparent foreground used for instant background previews. */
  cutout?: Blob;
  /**
   * Optional source-sized foreground colour layer produced by edge cleanup.
   * Its RGB values may differ from `source`, but its alpha remains the source
   * alpha; `alphaMatte` is still the only compositing-alpha authority.
   */
  foreground?: Blob;
  qualityMode: QualityMode;
  /** Retained in memory so background changes never rerun inference. */
  alphaMatte?: AlphaMatte;
  backgroundFill?: BackgroundFill;
  /** True while the visual preview is newer than the downloadable PNG. */
  backgroundPending?: boolean;
}
