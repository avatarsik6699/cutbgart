import { useCallback, useState } from "react";

import type { QualityMode } from "../../../entities/processed-image";

export const QUALITY_MODE_STORAGE_KEY = "qualityMode";

function readStoredQualityMode(): QualityMode | null {
  // TanStack Start renders this hook on the server first (no `window`) before
  // hydrating on the client — SPEC.md's `localStorage` persistence is
  // necessarily client-only.
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(QUALITY_MODE_STORAGE_KEY);
  return stored === "fast" || stored === "max" ? stored : null;
}

export interface UseQualityModeResult {
  qualityMode: QualityMode;
  setQualityMode: (mode: QualityMode) => void;
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
  const [qualityMode, setQualityModeState] = useState<QualityMode>(
    () => readStoredQualityMode() ?? defaultMode,
  );
  const [trackedDefaultMode, setTrackedDefaultMode] = useState(defaultMode);

  if (defaultMode !== trackedDefaultMode) {
    setTrackedDefaultMode(defaultMode);
    if (readStoredQualityMode() === null) {
      setQualityModeState(defaultMode);
    }
  }

  const setQualityMode = useCallback((mode: QualityMode) => {
    setQualityModeState(mode);
    window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, mode);
  }, []);

  return { qualityMode, setQualityMode };
}
