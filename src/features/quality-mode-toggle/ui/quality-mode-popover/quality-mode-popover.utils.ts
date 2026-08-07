import { m } from "@/paraglide/messages";

import type { QualityModeSelectorTypes } from "../quality-mode-selector";

export function selectedModeLabel(
  mode: QualityModeSelectorTypes.Props["qualityMode"],
): string {
  if (mode === "ben2-fp16") return m.processingModeBen2();
  if (mode === "isnet-fp32") return m.processingModePrecise();
  return m.processingModeFast();
}
