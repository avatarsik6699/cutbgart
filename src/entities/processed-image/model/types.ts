export type QualityMode = "fast" | "max";

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

export interface ProcessedImage {
  source: SourceImage;
  /** Composited PNG-with-alpha, produced via OffscreenCanvas. */
  result: Blob;
  qualityMode: QualityMode;
}
