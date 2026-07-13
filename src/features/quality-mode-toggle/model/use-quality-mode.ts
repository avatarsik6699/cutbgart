import { useCallback, useEffect, useState } from "react";

import type { AutomaticModelMode, QualityMode } from "../../../entities/processed-image";

export const QUALITY_MODE_STORAGE_KEY = "qualityMode";

function readStoredQualityMode(): AutomaticModelMode | null {
  // TanStack Start renders this hook on the server first (no `window`) before
  // hydrating on the client — SPEC.md's `localStorage` persistence is
  // necessarily client-only.
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(QUALITY_MODE_STORAGE_KEY);
  return stored === "fast" ? "isnet-q8" : stored === "max" ? "isnet-fp32" : null;
}

export interface UseQualityModeResult {
  qualityMode: AutomaticModelMode;
  setQualityMode: (mode: AutomaticModelMode) => void;
}

/**
 * Reads/writes the `qualityMode` `localStorage` preference (SPEC.md §3). When no
 * preference has been stored yet, tracks `defaultMode` (typically
 * `DeviceCapabilities.defaultQualityMode`, resolved asynchronously by the caller) so
 * the toggle reflects the device-appropriate default as soon as it's known, without
 * overwriting an explicit user choice. Adjusts state during render on a `defaultMode`
 * change rather than in an effect — the React-recommended pattern for this
 * (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
 * that avoids an extra commit.
 */
export function useQualityMode(defaultMode: QualityMode): UseQualityModeResult {
  const normalizedDefault =
    defaultMode === "max" || defaultMode === "isnet-fp32" ? "isnet-fp32" : "isnet-q8";
  const [qualityMode, setQualityModeState] =
    useState<AutomaticModelMode>(normalizedDefault);
  const [trackedDefaultMode, setTrackedDefaultMode] = useState(normalizedDefault);
  const [hasExplicitChoice, setHasExplicitChoice] = useState(false);

  useEffect(() => {
    const stored = readStoredQualityMode();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only; applying it after hydration keeps the SSR/client markup identical.
      setHasExplicitChoice(true);
      setQualityModeState(stored);
    }
  }, []);

  if (normalizedDefault !== trackedDefaultMode) {
    setTrackedDefaultMode(normalizedDefault);
    if (!hasExplicitChoice) {
      setQualityModeState(normalizedDefault);
    }
  }

  const setQualityMode = useCallback((mode: AutomaticModelMode) => {
    setHasExplicitChoice(true);
    setQualityModeState(mode);
    // BEN2 is intentionally session-only. Preserve the established storage
    // contract only when an IS-Net preference is explicitly selected.
    if (mode === "isnet-q8") {
      window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, "fast");
    } else if (mode === "isnet-fp32") {
      window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, "max");
    }
  }, []);

  return { qualityMode, setQualityMode };
}
