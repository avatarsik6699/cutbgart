import { m } from "@/paraglide/messages";
import type { AutomaticModelMode } from "@/shared/lib";

import type { SingleImageTypes } from "./single-image.types";

export function isAutomaticProcessingPhase(phase: SingleImageTypes.Phase): boolean {
  return phase === "preparing" || phase === "loading-model" || phase === "processing";
}

function modeLabel(mode: AutomaticModelMode | null): string {
  switch (mode) {
    case "isnet-fp32":
      return m.processingModePrecise();
    case "ben2-fp16":
      return m.processingModeBen2();
    case "isnet-q8":
      return m.processingModeFast();
    default:
      return m.processingModeLabel();
  }
}

export function processingStatusText(
  phase: SingleImageTypes.Phase,
  qualityMode: AutomaticModelMode | null,
  progressPercent: number | null,
): string {
  switch (phase) {
    case "loading-model":
      return m.loadingModel({
        mode: modeLabel(qualityMode),
        progress: String(progressPercent ?? 0),
      });
    case "processing":
      return m.removingBackground();
    case "preparing":
      return m.preparing();
    default:
      return "";
  }
}
