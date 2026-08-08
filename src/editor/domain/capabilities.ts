import type { ProcessingBackend } from "./processing";

export type CapabilitySupport = "supported" | "unsupported" | "unknown";
export type LocalInferencePath = "webgpu" | "wasm";

export type BrowserProcessingCapabilities = {
  backend: Extract<ProcessingBackend, "local">;
  dedicatedWorker: CapabilitySupport;
  offscreenCanvas: CapabilitySupport;
  webGpu: CapabilitySupport;
  availableInferencePaths: readonly LocalInferencePath[];
  maxHeavyJobs: 1;
};
