import type { RemoveBackgroundState } from "../../../features/remove-background";
import type { UploadValidationError } from "../../../features/upload-image";
import { m } from "@/paraglide/messages";

function uploadErrorMessage(error: UploadValidationError): string {
  if (error.code === "unsupported-format") {
    const format = error.message.match(/"([^"]+)"/)?.[1] ?? "unknown";
    return m.uploadUnsupported({ format });
  }
  if (error.code === "exceeds-size-limit") return m.uploadTooLarge();
  return m.uploadResolutionError();
}

/**
 * Human-readable summary of the composed flow's current phase, fed into the
 * widget's `aria-live="polite"` region (SPEC.md §5.4) — screen-reader users
 * get the same state transitions sighted users see (idle/loading/ready/error).
 */
export function describeState(
  state: RemoveBackgroundState,
  lightweightMode: boolean,
  uploadError: UploadValidationError | null,
): string {
  if (uploadError) return uploadErrorMessage(uploadError);

  switch (state.status) {
    case "idle":
      return m.stateIdle();
    case "model-loading": {
      const modeLabel =
        state.qualityMode === "max" || state.qualityMode === "isnet-fp32"
          ? m.processingModePrecise()
          : state.qualityMode === "ben2-fp16"
            ? m.processingModeBen2()
            : m.processingModeFast();
      return m.stateLoading({
        mode: lightweightMode ? `${modeLabel} · WASM` : modeLabel,
        progress: Math.round(state.progress),
      });
    }
    case "ready":
      return m.stateModelReady();
    case "processing":
      return m.removingBackground();
    case "result":
      return m.stateResult();
    case "correcting":
      return m.stateCorrecting();
    case "error":
      return state.error.message;
  }
}
