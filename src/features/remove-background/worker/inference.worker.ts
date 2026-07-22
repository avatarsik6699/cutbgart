import { env, pipeline, type ImageSegmentationPipeline } from "@huggingface/transformers";

import type {
  AlphaMatte,
  AutomaticModelMode,
  BackgroundFill,
  InferencePath,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";
import { env as appEnv } from "../../../shared/config";
import {
  createModelSourceLoader,
  type ModelSource,
} from "../../../shared/lib/model-source-loader";
import {
  compositeProcessedImage,
  extractAlphaMatte,
  recompositeProcessedImage,
} from "../lib/compositing";
import { getProductionModel, normalizeModelMode } from "../model/model-info";

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

// Capture Transformers.js's upstream defaults before selecting the Phase 14
// VPS/Cloudflare CDN. `createModelSourceLoader` serializes pipeline creation:
// these hosts live on one mutable library-global env object, so changing them
// concurrently while two models initialize would create mixed-source loads.
const upstreamRemoteHost = env.remoteHost;
const upstreamWasmPaths = env.backends.onnx.wasm?.wasmPaths;
let pinnedRemotePathTemplate = "{model}/resolve/main/";

function selectModelSource(source: ModelSource): void {
  // Transformers.js 4.2's pipeline registry probes expected files without
  // forwarding the pipeline's `revision`. Force every model request from this
  // worker (including registry probes on either source) through the pinned SHA.
  env.remotePathTemplate = pinnedRemotePathTemplate;
  if (source === "cdn" && appEnv.modelCdnBaseUrl) {
    env.remoteHost = `${appEnv.modelCdnBaseUrl}/`;
    env.backends.onnx.wasm!.wasmPaths = `${appEnv.modelCdnBaseUrl}/onnxruntime-web/${appEnv.onnxRuntimeWebVersion}/`;
  } else {
    env.remoteHost = upstreamRemoteHost;
    env.backends.onnx.wasm!.wasmPaths = upstreamWasmPaths;
  }
}

const modelSourceLoader = createModelSourceLoader({
  cdnConfigured: Boolean(appEnv.modelCdnBaseUrl),
  selectSource: selectModelSource,
});

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
  backgroundFill?: BackgroundFill;
}

export interface DisposeRequest {
  type: "dispose";
  requestId: string;
}

export type WorkerRequest =
  | LoadModelRequest
  | ProcessRequest
  | ExtractAlphaMatteRequest
  | RecompositeRequest
  | DisposeRequest;

export interface ModelProgressResponse {
  type: "model-progress";
  qualityMode: QualityMode;
  percent: number;
  loaded: number;
  total: number;
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

export interface FallbackToIsnetResponse {
  type: "fallback-to-isnet";
  qualityMode: QualityMode;
  reason: "webgpu-unavailable" | "model-failed" | "device-out-of-memory";
}

export interface ProcessResultResponse {
  type: "process-result";
  requestId: string;
  result: Blob;
  matte: AlphaMatte;
  durationMs: number;
  actualMode?: AutomaticModelMode;
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

export interface DisposedResponse {
  type: "disposed";
  requestId: string;
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
  | FallbackToIsnetResponse
  | ProcessResultResponse
  | AlphaMatteResultResponse
  | RecompositeResultResponse
  | DisposedResponse
  | WorkerErrorResponse;

interface ActiveSegmenter {
  key: string;
  segmenter: ImageSegmentationPipeline;
}

// One automatic ONNX session at a time. Repeated work in the same mode is
// warm; switching awaits disposal before constructing the next session.
let activeSegmenter: ActiveSegmenter | null = null;
let loadingSegmenter: Promise<ImageSegmentationPipeline> | null = null;
let ben2FallbackMode: InferencePath | null = null;

function post(response: WorkerResponse, transfer?: Transferable[]): void {
  workerScope.postMessage(response, transfer);
}

async function disposeActiveSegmenter(): Promise<void> {
  const active = activeSegmenter;
  activeSegmenter = null;
  loadingSegmenter = null;
  if (active) await active.segmenter.dispose();
}

async function loadSegmenter(
  qualityMode: QualityMode,
  inferencePath: InferencePath,
): Promise<ImageSegmentationPipeline> {
  const profile = getProductionModel(qualityMode);
  const cacheKey = `${profile.id}:${inferencePath}`;
  if (activeSegmenter?.key === cacheKey) return activeSegmenter.segmenter;
  if (loadingSegmenter) await loadingSegmenter.catch(() => undefined);
  if (activeSegmenter?.key === cacheKey) return activeSegmenter.segmenter;
  await disposeActiveSegmenter();
  pinnedRemotePathTemplate = `{model}/resolve/${profile.revision}/`;
  // The source loader selects its initial host while this module is evaluated,
  // before a concrete production profile is known. Re-apply the currently
  // selected source after choosing the profile so registry probes use this
  // model's immutable revision instead of the bootstrap `resolve/main` path.
  selectModelSource(modelSourceLoader.current());

  const load = (async () => {
    const createPipeline = () =>
      pipeline("image-segmentation", profile.modelId, {
        revision: profile.revision,
        device: inferencePath,
        dtype: profile.dtype,
        progress_callback: (info) => {
          if (info.status === "progress_total") {
            post({
              type: "model-progress",
              qualityMode,
              percent: info.progress,
              loaded: info.loaded,
              total: info.total,
            });
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
          void segmenter.dispose();
          throw new Error(
            `Model "${profile.modelId}" (${profile.dtype}) loaded without a usable processor`,
          );
        }
        return segmenter;
      });

    const segmenter = await modelSourceLoader.load(createPipeline, {
      onFallback: (cdnError) => {
        post({
          type: "log",
          qualityMode,
          message: `model CDN unavailable; retrying pinned revision upstream (${toErrorMessage(cdnError)})`,
        });
      },
    });
    activeSegmenter = { key: cacheKey, segmenter };
    return segmenter;
  })();
  loadingSegmenter = load;
  try {
    return await load;
  } finally {
    if (loadingSegmenter === load) loadingSegmenter = null;
  }
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
  const requestedMode = normalizeModelMode(request.qualityMode);
  const requestedProfile = getProductionModel(requestedMode);
  ben2FallbackMode = null;
  try {
    let actualMode: QualityMode = requestedMode;
    let actualPath = request.inferencePath;
    if (requestedProfile.requiresWebGPU && request.inferencePath !== "webgpu") {
      actualMode = "isnet-q8";
      actualPath = "wasm";
      ben2FallbackMode = actualPath;
      post({
        type: "fallback-to-isnet",
        qualityMode: request.qualityMode,
        reason: "webgpu-unavailable",
      });
    }
    try {
      await loadSegmenter(actualMode, actualPath);
    } catch (error) {
      if (requestedMode !== "ben2-fp16") throw error;
      await disposeActiveSegmenter();
      actualMode = "isnet-q8";
      actualPath = request.inferencePath === "webgpu" ? "webgpu" : "wasm";
      ben2FallbackMode = actualPath;
      post({
        type: "fallback-to-isnet",
        qualityMode: request.qualityMode,
        reason: isOutOfMemoryError(error) ? "device-out-of-memory" : "model-failed",
      });
      await loadSegmenter(actualMode, actualPath);
    }
    post({
      type: "log",
      qualityMode: request.qualityMode,
      message: "building ONNX session",
    });
    post({
      type: "model-ready",
      qualityMode: request.qualityMode,
      inferencePath: actualPath,
      dtype: getProductionModel(actualMode).dtype,
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

async function segmentWithWebGpuFallback(request: ProcessRequest): Promise<{
  output: Awaited<ReturnType<ImageSegmentationPipeline>>;
  actualMode: AutomaticModelMode;
}> {
  const requestedMode = normalizeModelMode(request.qualityMode);
  if (requestedMode === "ben2-fp16" && ben2FallbackMode) {
    const segmenter = await loadSegmenter("isnet-q8", ben2FallbackMode);
    return { output: await segmenter(request.source.blob), actualMode: "isnet-q8" };
  }
  try {
    const segmenter = await loadSegmenter(request.qualityMode, request.inferencePath);
    return {
      output: await segmenter(request.source.blob),
      actualMode: requestedMode,
    };
  } catch (error) {
    if (requestedMode === "ben2-fp16") {
      await disposeActiveSegmenter();
      const path = request.inferencePath === "webgpu" ? "webgpu" : "wasm";
      ben2FallbackMode = path;
      post({
        type: "fallback-to-isnet",
        qualityMode: request.qualityMode,
        reason: isOutOfMemoryError(error) ? "device-out-of-memory" : "model-failed",
      });
      const fallback = await loadSegmenter("isnet-q8", path);
      return { output: await fallback(request.source.blob), actualMode: "isnet-q8" };
    }
    if (request.inferencePath !== "webgpu" || !isWebGpuExecutionError(error)) {
      throw error;
    }
    post({ type: "fallback-to-wasm", qualityMode: request.qualityMode });
    const wasmSegmenter = await loadSegmenter(request.qualityMode, "wasm");
    return {
      output: await wasmSegmenter(request.source.blob),
      actualMode: requestedMode,
    };
  }
}

async function handleProcess(request: ProcessRequest): Promise<void> {
  const startedAt = performance.now();
  try {
    const { output, actualMode } = await segmentWithWebGpuFallback(request);
    const [segment] = output;
    if (!segment) {
      throw new Error("Model returned no segmentation mask");
    }
    const { data, width, height } = segment.mask;
    const matteData =
      data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
    const processedImage = await compositeProcessedImage(
      request.source,
      { width, height, data: matteData },
      actualMode,
    );
    post({
      type: "process-result",
      requestId: request.requestId,
      result: processedImage.result,
      matte: processedImage.alphaMatte!,
      durationMs: Math.round(performance.now() - startedAt),
      actualMode,
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
    const result = await recompositeProcessedImage(
      request.image,
      request.matte,
      request.backgroundFill,
    );
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
  if (request.type === "dispose") {
    void disposeActiveSegmenter().then(() =>
      post({ type: "disposed", requestId: request.requestId }),
    );
  } else if (request.type === "load-model") {
    void handleLoadModel(request);
  } else if (request.type === "process") {
    void handleProcess(request);
  } else if (request.type === "extract-alpha-matte") {
    void handleExtractAlphaMatte(request);
  } else if (request.type === "recomposite") {
    void handleRecomposite(request);
  }
});
