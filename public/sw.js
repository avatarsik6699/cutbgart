// Versioned cache for published model/WASM assets only. Editor pixels, source
// names, masks and composites are never written here (PHASE_22 I5).
const CACHE_PREFIX = "bg-remove-model-cache-";
const CACHE_NAME = `${CACHE_PREFIX}v2-v0.22.0`;
const MANIFEST_URL = "/models.manifest.json";
let manifestPromise;

function isModelAsset(url) {
  const { pathname } = new URL(url);
  return (
    pathname.includes("/resolve/") ||
    pathname.includes("/onnxruntime-web/") ||
    pathname.includes("/onnxruntime-web@") ||
    /\.(onnx|wasm)$/.test(pathname)
  );
}

async function loadManifest() {
  manifestPromise ??= fetch(MANIFEST_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`manifest unavailable (${response.status})`);
      return response.json();
    })
    .then((manifest) => {
      if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
        throw new Error("unsupported model manifest");
      }
      return manifest;
    })
    .catch((error) => {
      manifestPromise = undefined;
      throw error;
    });
  return manifestPromise;
}

function manifestAssetForUrl(manifest, url) {
  const pathname = new URL(url).pathname;
  return manifest.assets.find((asset) => {
    if (pathname.endsWith(`/${asset.path}`)) return true;
    const runtime = /^npm:onnxruntime-web@(.+)$/.exec(asset.revision);
    if (!runtime) return false;
    const fileName = asset.path.split("/").at(-1);
    return (
      pathname.endsWith(`/onnxruntime-web/${runtime[1]}/${fileName}`) ||
      pathname.endsWith(`/onnxruntime-web@${runtime[1]}/dist/${fileName}`)
    );
  });
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) client.postMessage(message);
}

async function clearModelCaches() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX))
      .map((name) => caches.delete(name)),
  );
}

async function evictOrphans(cache, manifest) {
  const requests = await cache.keys();
  await Promise.all(
    requests.map(async (request) => {
      if (!manifestAssetForUrl(manifest, request.url)) await cache.delete(request);
    }),
  );
}

async function cacheStatus() {
  const manifest = await loadManifest();
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  const paths = new Set(
    requests.flatMap((request) => {
      const asset = manifestAssetForUrl(manifest, request.url);
      return asset ? [asset.path] : [];
    }),
  );
  const usageBytes = manifest.assets
    .filter((asset) => paths.has(asset.path))
    .reduce((sum, asset) => sum + asset.byteSize, 0);
  const estimate = await self.navigator.storage?.estimate?.();
  return {
    type: "MODEL_CACHE_STATUS",
    release: manifest.release,
    assetCount: paths.size,
    usageBytes,
    quotaBytes: estimate?.quota ?? null,
    totalOriginUsageBytes: estimate?.usage ?? null,
  };
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      const manifest = await loadManifest();
      await evictOrphans(await caches.open(CACHE_NAME), manifest);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const port = event.ports[0];
  if (event.data?.type === "GET_MODEL_CACHE_STATUS") {
    event.waitUntil(
      cacheStatus()
        .then((status) => port?.postMessage(status))
        .catch((error) =>
          port?.postMessage({
            type: "MODEL_CACHE_ERROR",
            code: "status-failed",
            message: String(error),
          }),
        ),
    );
  }
  if (event.data?.type === "CLEAR_MODEL_CACHE") {
    event.waitUntil(
      clearModelCaches()
        .then(() => caches.open(CACHE_NAME))
        .then(() => {
          port?.postMessage({ type: "MODEL_CACHE_CLEARED" });
          return notifyClients({ type: "MODEL_CACHE_CLEARED" });
        })
        .catch((error) =>
          port?.postMessage({
            type: "MODEL_CACHE_ERROR",
            code: "clear-failed",
            message: String(error),
          }),
        ),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isModelAsset(request.url)) return;

  event.respondWith(
    (async () => {
      let manifest;
      let asset;
      try {
        manifest = await loadManifest();
        asset = manifestAssetForUrl(manifest, request.url);
      } catch (error) {
        console.error("[sw] model manifest failed:", error);
        return fetch(request);
      }
      // A model-looking URL outside the reviewed lockfile is never persisted.
      if (!asset) return fetch(request);

      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        const digest = cached.headers.get("X-Cutbg-Asset-Sha256");
        const release = cached.headers.get("X-Cutbg-Model-Release");
        if (
          cached.status === 200 &&
          digest === asset.sha256 &&
          release === manifest.release
        ) {
          return cached;
        }
        await cache.delete(request);
        await notifyClients({
          type: "MODEL_CACHE_ERROR",
          code: "corrupt-entry",
          assetPath: asset.path,
        });
      }

      try {
        const response = await fetch(request);
        // Range probes return 206 and cannot be stored in Cache Storage.
        if (response.status !== 200) return response;
        const headers = new Headers(response.headers);
        headers.set("X-Cutbg-Asset-Sha256", asset.sha256);
        headers.set("X-Cutbg-Model-Release", manifest.release);
        const verifiedReleaseResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        try {
          await cache.put(request, verifiedReleaseResponse.clone());
        } catch (error) {
          // Quota pressure must not break the active inference request.
          await caches.delete(CACHE_NAME);
          await notifyClients({
            type: "MODEL_CACHE_ERROR",
            code: "quota-or-write-failed",
            assetPath: asset.path,
          });
          console.error(`[sw] cache write failed for ${request.url}:`, error);
        }
        return verifiedReleaseResponse;
      } catch (error) {
        console.error(`[sw] fetch failed for ${request.url}:`, error);
        return new Response(null, {
          status: 503,
          statusText: "model asset unavailable",
          headers: {
            "X-Cutbg-Model-Error": "unavailable",
            "X-Cutbg-Asset-Path": asset.path,
          },
        });
      }
    })(),
  );
});
