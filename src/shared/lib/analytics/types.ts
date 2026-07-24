// Phase 05, per SPEC.md §7.6 — aggregate funnel counters only, no PII, no
// image data, no linkage to a specific image or its content (SPEC.md §1.1).
export type AnalyticsEvent =
  | "model_load_started"
  | "model_load_completed"
  | "model_load_failed"
  | "processing_started"
  | "processing_completed"
  | "processing_failed"
  | "download_clicked"
  | "webgpu_unavailable_fallback";

// Fixed aggregate dimensions only. This deliberately cannot carry arbitrary
// filenames, hashes, image-derived values, EXIF, masks or session identifiers.
export interface AnalyticsEventData {
  qualityMode?: "fast" | "max" | "isnet-q8" | "isnet-fp32" | "ben2-fp16";
  inferencePath?: "webgpu" | "wasm";
}
