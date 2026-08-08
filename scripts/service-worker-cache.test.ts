import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("model Service Worker cache policy", () => {
  it("versions and migrates only the dedicated model cache", async () => {
    const source = await readFile(path.join(root, "public", "sw.js"), "utf8");
    expect(source).toContain('CACHE_PREFIX = "bg-remove-model-cache-"');
    expect(source).toContain("name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME");
    expect(source).toContain("evictOrphans");
    expect(source).toContain("self.clients.claim()");
  });

  it("admits only manifest assets and keeps 206 range probes out of storage", async () => {
    const source = await readFile(path.join(root, "public", "sw.js"), "utf8");
    expect(source).toContain("manifestAssetForUrl");
    expect(source).toContain("if (!asset) return fetch(request)");
    expect(source).toContain("if (response.status !== 200) return response");
    expect(source).not.toMatch(/response\.ok[\s\S]{0,120}cache\.put/);
  });

  it("supports status, safe clearing, corruption and quota recovery", async () => {
    const source = await readFile(path.join(root, "public", "sw.js"), "utf8");
    expect(source).toContain("GET_MODEL_CACHE_STATUS");
    expect(source).toContain("CLEAR_MODEL_CACHE");
    expect(source).toContain("cachedAssets");
    expect(source).toContain("({ path, revision, byteSize })");
    expect(source).toContain("navigator.storage?.estimate");
    expect(source).toContain('"corrupt-entry"');
    expect(source).toContain('"quota-exceeded"');
    expect(source).toContain('"write-failed"');
    expect(source).toContain('error.name === "QuotaExceededError"');
    expect(source).not.toMatch(/localStorage|indexedDB|image\/png/);
  });

  it("only wipes the cache on real quota exhaustion, never on a transient write error", async () => {
    const source = await readFile(path.join(root, "public", "sw.js"), "utf8");
    const catchBlock = source.slice(
      source.indexOf("try {\n          await cache.put"),
      source.indexOf("return verifiedReleaseResponse;"),
    );
    expect(catchBlock).toContain(
      'if (error instanceof DOMException && error.name === "QuotaExceededError") {',
    );
    expect(catchBlock.indexOf("caches.delete(CACHE_NAME)")).toBeLessThan(
      catchBlock.indexOf("notifyClients"),
    );
  });
});
