import { env, pipeline, type ImageSegmentationPipeline } from "@huggingface/transformers";

import type {
  InferencePath,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";
import { env as appEnv } from "../../../shared/config";
import { compositeProcessedImage } from "../lib/compositing";

// `self` in a real dedicated worker is a `DedicatedWorkerGlobalScope`, but this
// project's tsconfig only loads the `DOM` lib (for the React app), under which
// `self` types as `Window` — whose `postMessage` overloads don't match a
// worker's. Scope to exactly the two members used here instead of pulling in
// the `WebWorker` lib, which would conflict with `DOM`'s duplicate globals.
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerRequest>) => void,
  ): void;
}
const workerScope = globalThis as unknown as WorkerScope;

// Mandatory — otherwise ONNX Runtime Web's WASM binaries re-download on every
// visit instead of being served from the browser cache (SPEC.md §6.1).
env.useWasmCache = true;

// Serve model weights and ONNX Runtime WASM binaries from our own R2 CDN
// mirror instead of huggingface.co / jsDelivr directly (SPEC.md §6), but only
// once that CDN is actually configured (production build arg). Without it,
// leave Transformers.js on its own upstream defaults — otherwise local
// `pnpm dev` would silently point at a CDN with nothing uploaded to it yet.
// The `{model}/resolve/{revision}/` path template is Transformers.js's
// default — keeping it means the R2 upload workflow only has to mirror the
// exact HF repo layout under `env.remoteHost`, no custom path scheme needed.
if (appEnv.modelCdnBaseUrl) {
  env.remoteHost = `${appEnv.modelCdnBaseUrl}/`;
  // `wasm` is typed as optional/readonly by `Partial<onnxruntime-common.Env>`,
  // but Transformers.js always initializes it before user code runs.
  env.backends.onnx.wasm!.wasmPaths = `${appEnv.modelCdnBaseUrl}/onnxruntime-web/${appEnv.onnxRuntimeWebVersion}/`;
}

const MODEL_IDS: Record<QualityMode, string> = {
  fast: "onnx-community/BiRefNet_lite-ONNX",
  max: "onnx-community/BiRefNet-ONNX",
};

export interface LoadModelRequest {
  type: "load-model";
  qualityMode: QualityMode;
  inferencePath: InferencePath;
}

export interface ProcessRequest {
  type: "process";
  requestId: string;
  qualityMode: QualityMode;
  inferencePath: InferencePath;
  source: SourceImage;
}

export type WorkerRequest = LoadModelRequest | ProcessRequest;

export interface ModelProgressResponse {
  type: "model-progress";
  qualityMode: QualityMode;
  percent: number;
}

export interface ModelReadyResponse {
  type: "model-ready";
  qualityMode: QualityMode;
}

export interface FallbackToWasmResponse {
  type: "fallback-to-wasm";
  qualityMode: QualityMode;
}

export interface ProcessResultResponse {
  type: "process-result";
  requestId: string;
  result: Blob;
}

export type WorkerErrorCode =
  "model-load-failed" | "device-out-of-memory" | "processing-failed";

export interface WorkerErrorResponse {
  type: "error";
  code: WorkerErrorCode;
  message: string;
  requestId?: string;
  qualityMode?: QualityMode;
}

export type WorkerResponse =
  | ModelProgressResponse
  | ModelReadyResponse
  | FallbackToWasmResponse
  | ProcessResultResponse
  | WorkerErrorResponse;

// Keyed on quality mode *and* inference path — a mid-session WebGPU-execution
// fallback (see `handleProcess`) can need both a webgpu and a wasm pipeline
// for the same quality mode, and they're genuinely different files (fp16 vs
// fp32 dtype), not interchangeable cache entries.
const segmenters = new Map<string, Promise<ImageSegmentationPipeline>>();

function segmenterCacheKey(
  qualityMode: QualityMode,
  inferencePath: InferencePath,
): string {
  return `${qualityMode}:${inferencePath}`;
}

function post(response: WorkerResponse, transfer?: Transferable[]): void {
  workerScope.postMessage(response, transfer);
}

function loadSegmenter(
  qualityMode: QualityMode,
  inferencePath: InferencePath,
): Promise<ImageSegmentationPipeline> {
  const cacheKey = segmenterCacheKey(qualityMode, inferencePath);
  let cached = segmenters.get(cacheKey);
  if (!cached) {
    cached = pipeline("image-segmentation", MODEL_IDS[qualityMode], {
      device: inferencePath,
      // Both onnx-community/BiRefNet{,_lite}-ONNX only publish `model.onnx`
      // (fp32) and `model_fp16.onnx` — no q8 variant, unlike most
      // Transformers.js repos (confirmed against the HF API tree). Requesting
      // the library's usual WASM default of "q8" 404s, so WASM falls back to
      // fp32 instead of SPEC.md §6.1's generic "q8 on WASM" guidance.
      dtype: inferencePath === "webgpu" ? "fp16" : "fp32",
      progress_callback: (info) => {
        if (info.status === "progress_total") {
          post({ type: "model-progress", qualityMode, percent: info.progress });
        }
      },
    }).then((segmenter) => {
      // Transformers.js silently constructs the pipeline with `processor:
      // null` (instead of throwing) if its internal file-existence check for
      // `preprocessor_config.json` fails for any reason (a transient network
      // hiccup fetching repo metadata, observed during manual verification of
      // this phase — the file itself was independently confirmed reachable).
      // Left unchecked, the pipeline still reports "ready" and only breaks
      // later, deep inside inference (`this.processor is not a function`),
      // misclassified as a processing failure instead of a model-load
      // failure. Fail fast here instead, in the SPEC.md §7.3 "model load
      // failure" bucket (retry action) — see docs/KNOWN_GOTCHAS.md.
      if (typeof segmenter.processor !== "function") {
        throw new Error(
          `Model "${MODEL_IDS[qualityMode]}" loaded without a usable processor — likely a transient failure fetching repo metadata`,
        );
      }
      return segmenter;
    });
    // Don't let a failed load permanently poison the cache — otherwise a
    // rejected promise stays cached forever and `retry()` (SPEC.md §7.3)
    // would just re-reject instantly instead of actually re-attempting.
    // Attaching this extra `.catch()` (a separate derived promise) only
    // evicts the cache entry; it doesn't change what callers awaiting
    // `cached` itself observe.
    cached.catch(() => {
      if (segmenters.get(cacheKey) === cached) {
        segmenters.delete(cacheKey);
      }
    });
    segmenters.set(cacheKey, cached);
  }
  return cached;
}

function isOutOfMemoryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /out of memory|oom|allocation failed|device was lost/i.test(message);
}

// Some model ops need more storage-buffer bindings than a given WebGPU
// device's shader stage limit allows (observed: "Too many storage buffers in
// shader" from onnxruntime-web's WebGPU execution provider) — a failure mode
// distinct from, and not detectable via, the adapter-presence/fp16-support
// check `detectDeviceCapabilities()` already does. Like a missing adapter or
// missing fp16 support, this only shows up for *this* device at actual
// inference time, not upfront, so it needs the same auto-fallback treatment
// (SPEC.md §7.3's mandatory WebGPU-unavailable fallback) at the point it's
// actually detected.
function isWebGpuExecutionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ortrun|webgpu|shader_helper|storage buffers?/i.test(message);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function handleLoadModel(request: LoadModelRequest): Promise<void> {
  try {
    await loadSegmenter(request.qualityMode, request.inferencePath);
    post({ type: "model-ready", qualityMode: request.qualityMode });
  } catch (error) {
    post({
      type: "error",
      code: "model-load-failed",
      message: toErrorMessage(error),
      qualityMode: request.qualityMode,
    });
  }
}

async function segmentWithWebGpuFallback(
  request: ProcessRequest,
): ReturnType<ImageSegmentationPipeline> {
  try {
    const segmenter = await loadSegmenter(request.qualityMode, request.inferencePath);
    return await segmenter(request.source.blob);
  } catch (error) {
    if (request.inferencePath !== "webgpu" || !isWebGpuExecutionError(error)) {
      throw error;
    }
    post({ type: "fallback-to-wasm", qualityMode: request.qualityMode });
    const wasmSegmenter = await loadSegmenter(request.qualityMode, "wasm");
    return wasmSegmenter(request.source.blob);
  }
}

async function handleProcess(request: ProcessRequest): Promise<void> {
  try {
    const [segment] = await segmentWithWebGpuFallback(request);
    if (!segment) {
      throw new Error("Model returned no segmentation mask");
    }
    const { data, width, height } = segment.mask;
    const matteData =
      data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
    const processedImage = await compositeProcessedImage(
      request.source,
      { width, height, data: matteData },
      request.qualityMode,
    );
    post({
      type: "process-result",
      requestId: request.requestId,
      result: processedImage.result,
    });
  } catch (error) {
    post({
      type: "error",
      code: isOutOfMemoryError(error) ? "device-out-of-memory" : "processing-failed",
      message: toErrorMessage(error),
      requestId: request.requestId,
    });
  }
}

workerScope.addEventListener("message", (event) => {
  const request = event.data;
  if (request.type === "load-model") {
    void handleLoadModel(request);
  } else {
    void handleProcess(request);
  }
});
