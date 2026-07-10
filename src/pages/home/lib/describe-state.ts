import type { RemoveBackgroundState } from "../../../features/remove-background";
import type { UploadValidationError } from "../../../features/upload-image";

/**
 * Human-readable summary of the composed flow's current phase, fed into the
 * page's `aria-live="polite"` region (SPEC.md §5.4) — screen-reader users get
 * the same state transitions sighted users see (idle/loading/ready/error).
 */
export function describeState(
  state: RemoveBackgroundState,
  lightweightMode: boolean,
  uploadError: UploadValidationError | null,
): string {
  if (uploadError) return uploadError.message;

  switch (state.status) {
    case "idle":
      return "Ready to upload an image.";
    case "model-loading": {
      const modeLabel = state.qualityMode === "max" ? "max quality" : "fast";
      const lightweightSuffix = lightweightMode ? " in lightweight mode" : "";
      return `Loading ${modeLabel} model${lightweightSuffix}, ${String(Math.round(state.progress))} percent.`;
    }
    case "ready":
      return "Model ready, starting processing.";
    case "processing":
      return "Removing background…";
    case "result":
      return "Background removed. Result ready to review and download.";
    case "error":
      return state.error.message;
  }
}
