// Vite inlines `VITE_`-prefixed vars at build time — this is not a secret,
// just the base URL the worker/service worker prepend to content-hashed model
// weight & ONNX Runtime WASM paths (SPEC.md §6, §6.1). Left `undefined` when
// not explicitly configured — the worker then leaves Transformers.js on its
// own upstream defaults (Hugging Face Hub + jsDelivr), which is what makes
// local `pnpm dev` work out of the box without R2 ever being populated.
// Set via a real value (Docker build arg in production) once R2 is populated
// by `pnpm upload-model-weights` / the upload workflow.
const configuredModelCdnBaseUrl = import.meta.env.VITE_MODEL_CDN_BASE_URL as
  string | undefined;

export const env = {
  modelCdnBaseUrl: configuredModelCdnBaseUrl?.replace(/\/+$/, ""),
  // Must match the `onnxruntime-web` version pinned in package.json — the R2
  // upload workflow mirrors that version's `dist/` folder under this path
  // segment (.github/workflows/upload-model-weights.yml).
  onnxRuntimeWebVersion: "1.27.0",
};
