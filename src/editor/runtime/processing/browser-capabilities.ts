import type { BrowserProcessingCapabilities } from "@/editor/domain";

export type BrowserCapabilitySource = {
  dedicatedWorker: boolean;
  offscreenCanvas: boolean;
  webGpu: boolean | null;
};

export type WebGpuProbeSource = {
  requestAdapter(): Promise<{ features: { has(feature: string): boolean } } | null>;
};

function nativeCapabilitySource(): BrowserCapabilitySource {
  let webGpu: boolean | null = null;
  if (typeof navigator !== "undefined") {
    webGpu = typeof navigator.gpu !== "undefined";
  }
  return {
    dedicatedWorker: typeof Worker !== "undefined",
    offscreenCanvas: typeof OffscreenCanvas !== "undefined",
    webGpu,
  };
}

function capabilitySupport(
  value: boolean | null,
): "supported" | "unsupported" | "unknown" {
  if (value === null) return "unknown";
  return value ? "supported" : "unsupported";
}

export function detectBrowserProcessingCapabilities(
  source: BrowserCapabilitySource = nativeCapabilitySource(),
): BrowserProcessingCapabilities {
  return {
    backend: "local",
    dedicatedWorker: source.dedicatedWorker ? "supported" : "unsupported",
    offscreenCanvas: source.offscreenCanvas ? "supported" : "unsupported",
    webGpu: capabilitySupport(source.webGpu),
    availableInferencePaths:
      source.webGpu === true ? (["webgpu", "wasm"] as const) : (["wasm"] as const),
    maxHeavyJobs: 1,
  };
}

export async function resolveUsableInferencePath(
  requested: "webgpu" | "wasm",
  gpu: WebGpuProbeSource | null | undefined = typeof navigator === "undefined"
    ? null
    : navigator.gpu,
): Promise<"webgpu" | "wasm"> {
  if (requested === "wasm" || gpu == null) return "wasm";
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null && adapter.features.has("shader-f16") ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}
