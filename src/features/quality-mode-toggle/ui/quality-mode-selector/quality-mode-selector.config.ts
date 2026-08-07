import { Gem, Scale, Zap } from "lucide-react";

import { m } from "@/paraglide/messages";

import type { QualityModeSelectorTypes } from "./quality-mode-selector.types";

export const QUALITY_MODE_OPTIONS: readonly QualityModeSelectorTypes.Option[] = [
  {
    emphasized: false,
    id: "isnet-q8",
    icon: Zap,
    label: () => m.processingModeFast(),
    hint: () => m.processingModeFastHint(),
    meta: () => m.processingModeFastMeta(),
  },
  {
    emphasized: false,
    id: "isnet-fp32",
    icon: Scale,
    label: () => m.processingModePrecise(),
    hint: () => m.processingModeOptimalHint(),
    meta: () => m.processingModeOptimalMeta(),
  },
  {
    emphasized: true,
    id: "ben2-fp16",
    icon: Gem,
    label: () => m.processingModeBen2(),
    hint: () => m.processingModeMaximumHint(),
    meta: () => m.processingModeMaximumMeta(),
  },
];
