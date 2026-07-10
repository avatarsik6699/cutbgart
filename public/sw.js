// Cache-first caching for ML model weights and ONNX Runtime Web WASM binaries
// fetched from the R2 CDN (SPEC.md §3, §6.1). Both quality-mode variants
// (`BiRefNet_lite` / `BiRefNet`) and the WASM runtime cache independently —
// each lives at its own content-hashed URL (HF commit SHA / package version
// segment), so per-URL Cache Storage entries already give that for free with
// no extra bookkeeping in this file.
const CACHE_NAME = "bg-remove-model-cache-v1";

function isModelAsset(url) {
  const { pathname } = new URL(url);
  return (
    pathname.includes("/resolve/") ||
    pathname.includes("/onnxruntime-web/") ||
    /\.(onnx|wasm)$/.test(pathname)
  );
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isModelAsset(request.url)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      try {
        const response = await fetch(request);
        // Content-hashed paths are immutable — only cache successful, full
        // responses. Transformers.js probes every file's existence/size with
        // a `Range: bytes=0-0` request before downloading it for real
        // (utils/hub.js's `fetch_file_head`); the Cache API throws on `put()`
        // for the resulting 206 Partial Content response (still `.ok`), so
        // that case must be excluded explicitly, not just checked via `.ok`.
        if (response.status === 200) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        // A hard network failure (offline, DNS, CDN not populated yet, a
        // rejected cache.put() above, ...) must not reject the promise
        // passed to respondWith() — that leaves an unhandled rejection
        // logged straight to the console instead of a failure the caller's
        // own error handling can classify. Return a normal error Response
        // instead; Transformers.js already treats a non-ok Response as a
        // download failure. `statusText` must be plain ASCII — the Fetch
        // spec only allows ISO-8859-1 reason-phrase bytes, so no em dashes.
        console.error(`[sw] fetch failed for ${request.url}:`, error);
        return new Response(null, {
          status: 503,
          statusText: "sw fetch failed, see console",
        });
      }
    })(),
  );
});
