import type { InferencePath } from "../../../entities/processed-image";
import type { MattingRefinementMode } from "./types";

export interface MattingAttempt {
  mode: MattingRefinementMode;
  path: InferencePath;
}

/** Returns the only permitted next attempt; null terminates model retries. */
export function nextMattingAttempt(
  current: MattingAttempt,
  webGpuExecutionFailure: boolean,
): MattingAttempt | null {
  if (current.mode === "maximum") {
    return {
      mode: "balanced",
      path: current.path === "webgpu" && webGpuExecutionFailure ? "wasm" : current.path,
    };
  }
  if (
    current.mode === "balanced" &&
    current.path === "webgpu" &&
    webGpuExecutionFailure
  ) {
    return { mode: "balanced", path: "wasm" };
  }
  return null;
}
