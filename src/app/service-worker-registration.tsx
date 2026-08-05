import { useEffect } from "react";

/**
 * Registers the model-asset service worker for every public and internal route.
 * Registration is browser-idempotent, including React Strict Mode's development probe.
 */
export function ServiceWorkerRegistration() {
  useEffect(function registerModelAssetServiceWorkerFx() {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Model asset service worker registration failed", error);
    });
  }, []);

  return null;
}
