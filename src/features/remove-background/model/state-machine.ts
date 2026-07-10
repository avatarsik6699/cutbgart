import type { ProcessedImage, QualityMode } from "../../../entities/processed-image";

export type RemoveBackgroundErrorCode =
  | "unsupported-format"
  | "file-too-large"
  | "resolution-too-large"
  | "model-load-failed"
  | "device-out-of-memory"
  | "processing-failed";

/**
 * Every error carries a concrete message and an explicit recovery action —
 * never a bare "something went wrong" (SPEC.md §5.3).
 */
export interface RemoveBackgroundError {
  code: RemoveBackgroundErrorCode;
  message: string;
  action: "retry" | "reset";
}

// SPEC.md §5.3: idle -> model-loading -> ready -> processing -> result,
// with `error` reachable from every state.
export type RemoveBackgroundState =
  | { status: "idle" }
  | { status: "model-loading"; qualityMode: QualityMode; progress: number }
  | { status: "ready"; qualityMode: QualityMode }
  | { status: "processing"; qualityMode: QualityMode }
  | { status: "result"; result: ProcessedImage }
  | { status: "error"; error: RemoveBackgroundError };

export type RemoveBackgroundAction =
  | { type: "SELECT_FILE"; qualityMode: QualityMode }
  | { type: "MODEL_PROGRESS"; percent: number }
  | { type: "MODEL_READY" }
  | { type: "START_PROCESSING" }
  | { type: "PROCESSING_SUCCEEDED"; result: ProcessedImage }
  | { type: "FAILED"; error: RemoveBackgroundError }
  | { type: "RESET" };

export const initialRemoveBackgroundState: RemoveBackgroundState = { status: "idle" };

/** Pure reducer — no worker/DOM dependency, unit-testable in isolation (SPEC.md §7.7). */
export function removeBackgroundReducer(
  state: RemoveBackgroundState,
  action: RemoveBackgroundAction,
): RemoveBackgroundState {
  // `error` is reachable from every state.
  if (action.type === "FAILED") {
    return { status: "error", error: action.error };
  }
  if (action.type === "RESET") {
    return { status: "idle" };
  }

  switch (state.status) {
    case "idle":
    // `retry()` re-dispatches SELECT_FILE from an error state with the same
    // remembered source/qualityMode (see useBackgroundRemoval's `retry`).
    // eslint-disable-next-line no-fallthrough
    case "error":
      return action.type === "SELECT_FILE"
        ? { status: "model-loading", qualityMode: action.qualityMode, progress: 0 }
        : state;

    case "model-loading":
      if (action.type === "MODEL_PROGRESS") {
        return { ...state, progress: action.percent };
      }
      if (action.type === "MODEL_READY") {
        return { status: "ready", qualityMode: state.qualityMode };
      }
      return state;

    case "ready":
      return action.type === "START_PROCESSING"
        ? { status: "processing", qualityMode: state.qualityMode }
        : state;

    case "processing":
      return action.type === "PROCESSING_SUCCEEDED"
        ? { status: "result", result: action.result }
        : state;

    case "result":
      // "Recompute in max quality" reuses the loaded source with a new quality
      // mode; "process another image" goes through RESET above instead.
      return action.type === "SELECT_FILE"
        ? { status: "model-loading", qualityMode: action.qualityMode, progress: 0 }
        : state;
  }
}
