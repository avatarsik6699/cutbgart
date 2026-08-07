import { describe, expect, it } from "vitest";

import {
  detectBrowserProcessingCapabilities,
  resolveUsableInferencePath,
} from "./browser-capabilities";

describe("detectBrowserProcessingCapabilities", () => {
  it("reports WebGPU and its deterministic WASM fallback", () => {
    expect(
      detectBrowserProcessingCapabilities({
        dedicatedWorker: true,
        offscreenCanvas: true,
        webGpu: true,
      }),
    ).toEqual({
      backend: "local",
      dedicatedWorker: "supported",
      offscreenCanvas: "supported",
      webGpu: "supported",
      availableInferencePaths: ["webgpu", "wasm"],
      maxHeavyJobs: 1,
    });
  });

  it("keeps unknown support truthful and exposes only the safe path", () => {
    expect(
      detectBrowserProcessingCapabilities({
        dedicatedWorker: false,
        offscreenCanvas: false,
        webGpu: null,
      }),
    ).toMatchObject({
      dedicatedWorker: "unsupported",
      offscreenCanvas: "unsupported",
      webGpu: "unknown",
      availableInferencePaths: ["wasm"],
    });
  });

  it("selects WebGPU only after a usable fp16 adapter resolves", async () => {
    await expect(
      resolveUsableInferencePath("webgpu", {
        requestAdapter: () =>
          Promise.resolve({ features: { has: (feature) => feature === "shader-f16" } }),
      }),
    ).resolves.toBe("webgpu");
    await expect(
      resolveUsableInferencePath("webgpu", {
        requestAdapter: () => Promise.resolve(null),
      }),
    ).resolves.toBe("wasm");
    await expect(
      resolveUsableInferencePath("webgpu", {
        requestAdapter: () => Promise.reject(new Error("adapter unavailable")),
      }),
    ).resolves.toBe("wasm");
  });
});
