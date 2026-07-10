import { useEffect } from "react";

import { RemoveBackgroundTestPanel } from "../../../features/remove-background";

export function DevRemoveBackgroundPage() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return <RemoveBackgroundTestPanel />;
}
