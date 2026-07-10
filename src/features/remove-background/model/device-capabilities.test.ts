import { afterEach, describe, expect, it, vi } from "vitest";

import { detectDeviceCapabilities } from "./device-capabilities";

function fakeAdapter(features: string[]): {
  features: { has: (name: string) => boolean };
} {
  return { features: { has: (name: string) => features.includes(name) } };
}

function stubNavigator(overrides: {
  gpu?: { requestAdapter: () => Promise<unknown> } | undefined;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}): void {
  vi.stubGlobal("navigator", {
    ...navigator,
    gpu: overrides.gpu,
    hardwareConcurrency: overrides.hardwareConcurrency ?? navigator.hardwareConcurrency,
    deviceMemory: overrides.deviceMemory,
  });
}

describe("detectDeviceCapabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the WebGPU path and 'max' quality on a capable device with fp16 support", async () => {
    stubNavigator({
      gpu: { requestAdapter: () => Promise.resolve(fakeAdapter(["shader-f16"])) },
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });

    const capabilities = await detectDeviceCapabilities();

    expect(capabilities).toEqual({ inferencePath: "webgpu", defaultQualityMode: "max" });
  });

  it("downgrades to 'fast' quality on a weak device even with WebGPU available", async () => {
    stubNavigator({
      gpu: { requestAdapter: () => Promise.resolve(fakeAdapter(["shader-f16"])) },
      hardwareConcurrency: 2,
    });

    const capabilities = await detectDeviceCapabilities();

    expect(capabilities).toEqual({ inferencePath: "webgpu", defaultQualityMode: "fast" });
  });

  it("falls back to the WASM path when navigator.gpu is unavailable", async () => {
    stubNavigator({ gpu: undefined, hardwareConcurrency: 8, deviceMemory: 8 });

    const capabilities = await detectDeviceCapabilities();

    expect(capabilities).toEqual({ inferencePath: "wasm", defaultQualityMode: "fast" });
  });

  it("falls back to the WASM path when requestAdapter() resolves null", async () => {
    stubNavigator({
      gpu: { requestAdapter: () => Promise.resolve(null) },
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });

    const capabilities = await detectDeviceCapabilities();

    expect(capabilities.inferencePath).toBe("wasm");
  });

  it("falls back to the WASM path when requestAdapter() rejects", async () => {
    stubNavigator({
      gpu: { requestAdapter: () => Promise.reject(new Error("no adapter")) },
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });

    const capabilities = await detectDeviceCapabilities();

    expect(capabilities.inferencePath).toBe("wasm");
  });

  it("falls back to the WASM path when the adapter exists but doesn't support fp16 shaders", async () => {
    // Observed on headless/software WebGPU (e.g. SwiftShader) during manual
    // browser verification of this phase — a real adapter is returned, but
    // Transformers.js's mandatory fp16 dtype throws at model-load time.
    stubNavigator({
      gpu: { requestAdapter: () => Promise.resolve(fakeAdapter([])) },
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });

    const capabilities = await detectDeviceCapabilities();

    expect(capabilities).toEqual({ inferencePath: "wasm", defaultQualityMode: "fast" });
  });
});
