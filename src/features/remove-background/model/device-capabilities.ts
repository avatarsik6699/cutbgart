import { trackEvent } from "@/shared/lib/analytics";

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
 *
 * WebGPU probing was disabled for a while (hardcoded to WASM) after the
 * originally-shipped BiRefNet model proved unusable on WebGPU
 * (onnxruntime-web storage-buffer shader limit, microsoft/onnxruntime#21968).
 * Re-enabled now that the model has been swapped for IS-Net
 * (`worker/inference.worker.ts`'s `MODEL_ID`) — a much lighter classic
 * encoder-decoder without BiRefNet's Concat/Split fan-out, so there's no
 * known reason it should hit the same wall. This has *not* been confirmed
 * against a real WebGPU device in this project (only end-to-end via a
 * Node/onnxruntime-node smoke test, which can't exercise the WebGPU EP at
 * all) — if it turns out IS-Net has its own WebGPU issue, the worker's
 * mid-session catch (`isWebGpuExecutionError` in `inference.worker.ts`)
 * transparently falls back to WASM per-run, and the "lightweight mode"
 * banner (`useBackgroundRemoval`'s `lightweightMode`) will say so.
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  const hasUsableWebGPU = await supportsWebGPU();
  if (!hasUsableWebGPU) {
    trackEvent("webgpu_unavailable_fallback");
  }
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
