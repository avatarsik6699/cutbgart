import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("model Service Worker cache policy", () => {
  it("matches immutable revision assets and caches only full 200 responses", async () => {
    const source = await readFile(path.join(root, "public", "sw.js"), "utf8");
    expect(source).toContain('pathname.includes("/resolve/")');
    expect(source).toContain("response.status === 200");
    expect(source).toContain("await cache.put(request, response.clone())");
    expect(source).not.toMatch(/response\.ok[\s\S]{0,120}cache\.put/);
  });

  it("keeps 206 range probes outside Cache Storage", async () => {
    const source = await readFile(path.join(root, "public", "sw.js"), "utf8");
    expect(source).toMatch(/206 Partial Content/);
    expect(source).toMatch(/if \(response\.status === 200\)/);
  });
});
