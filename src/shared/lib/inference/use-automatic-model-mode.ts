import { useCallback, useEffect, useState } from "react";

import { safeLs } from "@/shared/lib/storage";

import type { AutomaticModelMode, AutomaticQualityMode } from "./production-model-config";

export const QUALITY_MODE_STORAGE_KEY = "qualityMode";

function normalize(mode: AutomaticQualityMode): AutomaticModelMode {
  if (mode === "fast") return "isnet-q8";
  if (mode === "max") return "isnet-fp32";
  return mode;
}

export type UseAutomaticModelModeResult = Readonly<{
  qualityMode: AutomaticModelMode;
  setQualityMode: (mode: AutomaticModelMode) => void;
}>;

/** Shared preference adapter. It stores only the established fast/max values. */
export function useAutomaticModelMode(
  defaultMode: AutomaticQualityMode,
): UseAutomaticModelModeResult {
  const normalizedDefault = normalize(defaultMode);
  const [explicitMode, setExplicitMode] = useState<AutomaticModelMode | null>(null);

  useEffect(() => {
    const stored = safeLs.getItem(QUALITY_MODE_STORAGE_KEY);
    if (stored === "fast" || stored === "max") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is client-only; post-hydration application keeps SSR markup stable.
      setExplicitMode(normalize(stored));
    }
  }, []);

  const setQualityMode = useCallback((mode: AutomaticModelMode) => {
    setExplicitMode(mode);
    if (mode === "isnet-q8") safeLs.setItem(QUALITY_MODE_STORAGE_KEY, "fast");
    else if (mode === "isnet-fp32") safeLs.setItem(QUALITY_MODE_STORAGE_KEY, "max");
  }, []);

  return { qualityMode: explicitMode ?? normalizedDefault, setQualityMode };
}
