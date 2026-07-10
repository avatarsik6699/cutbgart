import { useEffect, useState } from "react";

import type { QualityMode } from "../../../entities/processed-image";
import {
  detectDeviceCapabilities,
  RemoveBackgroundTestPanel,
} from "../../../features/remove-background";
import { QualityModeToggle, useQualityMode } from "../../../features/quality-mode-toggle";

export function DevRemoveBackgroundPage() {
  const [defaultQualityMode, setDefaultQualityMode] = useState<QualityMode>("fast");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void detectDeviceCapabilities().then((capabilities) => {
      if (!cancelled) {
        setDefaultQualityMode(capabilities.defaultQualityMode);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { qualityMode, setQualityMode } = useQualityMode(defaultQualityMode);

  return (
    <>
      <div className="mx-auto max-w-xl px-8 pt-8">
        <QualityModeToggle
          qualityMode={qualityMode}
          onQualityModeChange={setQualityMode}
        />
      </div>
      <RemoveBackgroundTestPanel qualityMode={qualityMode} />
    </>
  );
}
