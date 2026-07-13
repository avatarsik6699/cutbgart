import path from "node:path";

import { describe, expect, it } from "vitest";

import { collectRoutePaths, routeFileToSegment } from "./generate-sitemap";

describe("generate sitemap", () => {
  it("maps dot-segment route files", () => {
    expect(routeFileToSegment("dev.model-lab.tsx")).toBe("dev/model-lab");
  });

  it("excludes every top-level dev route, including the model lab", async () => {
    const routes = await collectRoutePaths(path.resolve("src/routes"), []);
    expect(routes).not.toContain("/dev/model-lab");
    expect(routes.some((route) => route.startsWith("/dev/"))).toBe(false);
  });
});
