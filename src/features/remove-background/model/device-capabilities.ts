import type { DeviceCapabilities } from "../../../entities/processed-image";

// `deviceMemory` is a Chrome-only experimental API, not part of lib.dom.d.ts.
interface NavigatorDeviceMemory {
  readonly deviceMemory?: number;
}

const WEAK_DEVICE_CORE_THRESHOLD = 4;
const WEAK_DEVICE_MEMORY_GIB_THRESHOLD = 4;

function isWeakDevice(): boolean {
  const { hardwareConcurrency } = navigator;
  const deviceMemory = (navigator as Navigator & NavigatorDeviceMemory).deviceMemory;

  if (
    typeof hardwareConcurrency === "number" &&
    hardwareConcurrency <= WEAK_DEVICE_CORE_THRESHOLD
  ) {
    return true;
  }
  if (
    typeof deviceMemory === "number" &&
    deviceMemory < WEAK_DEVICE_MEMORY_GIB_THRESHOLD
  ) {
    return true;
  }
  return false;
}

/**
 * Detects the inference path (WebGPU vs. WASM fallback) and the default quality
 * mode once per session (SPEC.md §2.2, §5.3). Never throws — `requestAdapter()`
 * failures resolve to the WASM fallback, matching the mandatory
 * WebGPU-unavailable auto-fallback behavior (SPEC.md §7.3).
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  const hasUsableWebGPU = await supportsWebGPU();
  const weak = isWeakDevice();

  return {
    inferencePath: hasUsableWebGPU ? "webgpu" : "wasm",
    defaultQualityMode: hasUsableWebGPU && !weak ? "max" : "fast",
  };
}

async function supportsWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    // `fp16` is mandatory on the WebGPU path (SPEC.md §6.1) — some adapters
    // (observed: headless/software WebGPU, e.g. SwiftShader) expose WebGPU
    // but lack the `shader-f16` feature, which makes Transformers.js throw
    // "The device (webgpu) does not support fp16" at model-load time instead
    // of falling back. Treat that as WebGPU being unusable so the mandatory
    // auto-fallback to WASM (SPEC.md §7.3) actually triggers before load.
    return adapter !== null && adapter.features.has("shader-f16");
  } catch {
    return false;
  }
}
