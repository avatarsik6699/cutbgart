import { m } from "@/paraglide/messages";

import type { QualityModeSelectorTypes } from "../quality-mode-selector";

export function selectedModeLabel(
  mode: QualityModeSelectorTypes.Props["qualityMode"],
): string {
  if (mode === "ben2-fp16") return m.processingModeBen2();
  if (mode === "isnet-fp32") return m.processingModePrecise();
  if (mode === "isnet-q8") return m.processingModeFast();
  return m.processingModeLabel();
}
