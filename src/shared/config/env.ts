// Vite inlines `VITE_`-prefixed vars at build time — this is not a secret,
// just the base URL the worker/service worker prepend to content-hashed model
// weight & ONNX Runtime WASM paths (SPEC.md §6, §6.1). Left `undefined` when
// not explicitly configured — the worker then leaves Transformers.js on its
// own upstream defaults (Hugging Face Hub + jsDelivr), which is what makes
// local `pnpm dev` work out of the box without the VPS asset mirror. When set,
// the worker prefers that CDN and automatically restores the captured
// Hugging Face/jsDelivr defaults if the private source fails (Phase 14).
const configuredModelCdnBaseUrl = import.meta.env.VITE_MODEL_CDN_BASE_URL as
  string | undefined;

// Analytics (Phase 05, SPEC.md §7.6): all three left `undefined` unless set,
// which is what keeps local `pnpm dev` script-free — `routes/__root.tsx` only
// injects the Umami/Cloudflare tags when their vars are configured.
const configuredUmamiScriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL as
  string | undefined;
const configuredUmamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID as
  string | undefined;
const configuredCfBeaconToken = import.meta.env.VITE_CF_BEACON_TOKEN as
  string | undefined;

export const env = {
  modelCdnBaseUrl: configuredModelCdnBaseUrl?.replace(/\/+$/, ""),
  // Must match package.json/models.manifest.json — model-sync copies that
  // installed version's `dist/` folder under this path segment.
  onnxRuntimeWebVersion: "1.27.0",
  umamiScriptUrl: configuredUmamiScriptUrl,
  umamiWebsiteId: configuredUmamiWebsiteId,
  cfBeaconToken: configuredCfBeaconToken,
};
