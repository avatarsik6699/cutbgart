import { env, pipeline, type ImageSegmentationPipeline } from "@huggingface/transformers";

import type {
  AlphaMatte,
  InferencePath,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";
import { env as appEnv } from "../../../shared/config";
import {
  compositeProcessedImage,
  extractAlphaMatte,
  recompositeProcessedImage,
} from "../lib/compositing";
import { DTYPES, MODEL_ID } from "../model/model-info";

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

// BiRefNet (both `_lite` and full) is unusable in-browser via onnxruntime-web:
// its Concat/Split-heavy graph exceeds the WebGPU EP's storage-buffer-per-shader
// limit on effectively every device (microsoft/onnxruntime#21968), and its fp32
// WASM path reliably hits `std::bad_alloc` under wasm32's address-space ceiling
// (same issue, confirmed independently in this project — see git history on
// this file). IS-Net (github.com/xuebinqin/DIS) is a much lighter classic
// encoder-decoder — no comparable fan-out — and is natively recognized by
// Transformers.js's pipeline resolution (`isnet` architecture), unlike
// briaai/RMBG-1.4's Segformer head, which the "image-segmentation" task
// rejects outright. Verified end-to-end (load + inference + correct mask
// dimensions/output) via this project's own Node smoke test before switching.
// One model, two dtypes stand in for the fast/max tiers BiRefNet's separate
// `_lite`/full files used to provide. `MODEL_ID`/`DTYPES` live in
// `../model/model-info` (not here) so the UI can display them too.

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

export interface ExtractAlphaMatteRequest {
  type: "extract-alpha-matte";
  requestId: string;
  result: Blob;
}

export interface RecompositeRequest {
  type: "recomposite";
  requestId: string;
  image: ProcessedImage;
  matte: AlphaMatte;
}

export type WorkerRequest =
  LoadModelRequest | ProcessRequest | ExtractAlphaMatteRequest | RecompositeRequest;

export interface ModelProgressResponse {
  type: "model-progress";
  qualityMode: QualityMode;
  percent: number;
}

// Granular per-file loading events (initiate/download/done — the aggregate
// download percent already has its own `ModelProgressResponse` channel).
// Purely informational, for the UI's optional log panel.
export interface WorkerLogResponse {
  type: "log";
  qualityMode: QualityMode;
  message: string;
}

export interface ModelReadyResponse {
  type: "model-ready";
  qualityMode: QualityMode;
  inferencePath: InferencePath;
  dtype: string;
}

export interface FallbackToWasmResponse {
  type: "fallback-to-wasm";
  qualityMode: QualityMode;
}

export interface ProcessResultResponse {
  type: "process-result";
  requestId: string;
  result: Blob;
  durationMs: number;
}

export interface AlphaMatteResultResponse {
  type: "alpha-matte-result";
  requestId: string;
  matte: AlphaMatte;
  durationMs: number;
}

export interface RecompositeResultResponse {
  type: "recomposite-result";
  requestId: string;
  result: ProcessedImage;
  durationMs: number;
}

export type WorkerErrorCode =
  | "model-load-failed"
  | "device-out-of-memory"
  | "processing-failed"
  | "compositing-failed";

export interface WorkerErrorResponse {
  type: "error";
  code: WorkerErrorCode;
  message: string;
  requestId?: string;
  qualityMode?: QualityMode;
}

export type WorkerResponse =
  | ModelProgressResponse
  | WorkerLogResponse
  | ModelReadyResponse
  | FallbackToWasmResponse
  | ProcessResultResponse
  | AlphaMatteResultResponse
  | RecompositeResultResponse
  | WorkerErrorResponse;

// Keyed on quality mode *and* inference path — a mid-session WebGPU-execution
// fallback (see `handleProcess`) can need both a webgpu and a wasm pipeline
// for the same quality mode, and those are separate `onnxruntime-web` sessions
// (different execution provider), not interchangeable cache entries, even
// though both currently resolve the same `dtype` per `DTYPES[qualityMode]`.
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
    cached = pipeline("image-segmentation", MODEL_ID, {
      device: inferencePath,
      // ISNet-ONNX publishes fp32/fp16/int8/uint8/q8 variants, unlike the old
      // BiRefNet exports — `q8` for "fast" keeps SPEC.md §6.1's original
      // "q8 on WASM" intent, `fp32` for "max" trades size/speed for precision.
      dtype: DTYPES[qualityMode],
      // `info.status` cycles through "initiate" -> "download" -> "progress"
      // (many, per chunk) -> "done" per file, plus a synthesized
      // "progress_total" aggregating all files (Transformers.js's
      // `DefaultProgressCallback`). "progress" is too high-frequency to log
      // usefully — the aggregate percent already covers it.
      progress_callback: (info) => {
        if (info.status === "progress_total") {
          post({ type: "model-progress", qualityMode, percent: info.progress });
        } else if (info.status === "initiate" || info.status === "done") {
          post({
            type: "log",
            qualityMode,
            message: `${info.status} ${info.file}`,
          });
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
          `Model "${MODEL_ID}" (${DTYPES[qualityMode]}) loaded without a usable processor — likely a transient failure fetching repo metadata`,
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
  // `bad_alloc` — onnxruntime-web's WASM heap allocator throwing this exact
  // C++ exception name is how a wasm32 address-space exhaustion actually
  // surfaces (observed running BiRefNet before the ISNet switch above).
  return /out of memory|oom|allocation failed|device was lost|bad_alloc/i.test(message);
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
    post({
      type: "model-ready",
      qualityMode: request.qualityMode,
      inferencePath: request.inferencePath,
      dtype: DTYPES[request.qualityMode],
    });
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
  const startedAt = performance.now();
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
      durationMs: Math.round(performance.now() - startedAt),
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

async function handleExtractAlphaMatte(request: ExtractAlphaMatteRequest): Promise<void> {
  const startedAt = performance.now();
  try {
    const matte = await extractAlphaMatte(request.result);
    post({
      type: "alpha-matte-result",
      requestId: request.requestId,
      matte,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    post({
      type: "error",
      code: "compositing-failed",
      message: toErrorMessage(error),
      requestId: request.requestId,
    });
  }
}

async function handleRecomposite(request: RecompositeRequest): Promise<void> {
  const startedAt = performance.now();
  try {
    const result = await recompositeProcessedImage(request.image, request.matte);
    post({
      type: "recomposite-result",
      requestId: request.requestId,
      result,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    post({
      type: "error",
      code: "compositing-failed",
      message: toErrorMessage(error),
      requestId: request.requestId,
    });
  }
}

workerScope.addEventListener("message", (event) => {
  const request = event.data;
  if (request.type === "load-model") {
    void handleLoadModel(request);
  } else if (request.type === "process") {
    void handleProcess(request);
  } else if (request.type === "extract-alpha-matte") {
    void handleExtractAlphaMatte(request);
  } else {
    void handleRecomposite(request);
  }
});
