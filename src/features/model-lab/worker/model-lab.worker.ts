import { env, pipeline, type ImageSegmentationPipeline } from "@huggingface/transformers";

import type {
  AlphaMatte,
  InferencePath,
  SourceImage,
} from "../../../entities/processed-image";
import { getEvaluationModel } from "../model/model-registry";
import type {
  BenchmarkMeasurement,
  EvaluationErrorCode,
  EvaluationModelId,
  ModelLabProcessRequest,
  ModelLabWorkerRequest,
  ModelLabWorkerResponse,
} from "../model/types";

interface WorkerScope {
  postMessage(message: ModelLabWorkerResponse): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ModelLabWorkerRequest>) => void,
  ): void;
}

const workerScope = globalThis as unknown as WorkerScope;
const upstreamRemoteHost = env.remoteHost;
const upstreamWasmPaths = env.backends.onnx.wasm?.wasmPaths;

env.useWasmCache = true;
env.remoteHost = upstreamRemoteHost;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = upstreamWasmPaths;

interface ActivePipeline {
  modelId: EvaluationModelId;
  inferencePath: InferencePath;
  segmenter: ImageSegmentationPipeline;
}

let activePipeline: ActivePipeline | null = null;
let cancelled = false;

function post(response: ModelLabWorkerResponse): void {
  if (!cancelled) workerScope.postMessage(response);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isOutOfMemoryError(error: unknown): boolean {
  return /out of memory|oom|allocation failed|device was lost|bad_alloc/i.test(
    toErrorMessage(error),
  );
}

function isWebGpuExecutionError(error: unknown): boolean {
  return /ortrun|webgpu|shader_helper|storage buffers?|device lost|not supported/i.test(
    toErrorMessage(error),
  );
}

async function disposeActivePipeline(): Promise<void> {
  const current = activePipeline;
  activePipeline = null;
  if (current) await current.segmenter.dispose();
}

async function loadPipeline(
  request: ModelLabProcessRequest,
  inferencePath: InferencePath,
): Promise<{ segmenter: ImageSegmentationPipeline; loadMs: number }> {
  if (
    activePipeline?.modelId === request.modelId &&
    activePipeline.inferencePath === inferencePath
  ) {
    return { segmenter: activePipeline.segmenter, loadMs: 0 };
  }

  await disposeActivePipeline();
  const profile = getEvaluationModel(request.modelId);
  env.remoteHost = upstreamRemoteHost;
  env.remotePathTemplate = `{model}/resolve/${profile.revision}/`;
  if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = upstreamWasmPaths;

  const startedAt = performance.now();
  const segmenter = await pipeline("image-segmentation", profile.modelId, {
    revision: profile.revision,
    dtype: profile.dtype,
    device: inferencePath,
    progress_callback: (info) => {
      if (info.status === "progress_total") {
        post({
          type: "progress",
          requestId: request.requestId,
          modelId: request.modelId,
          stage: "loading",
          percent: info.progress,
        });
      }
    },
  });

  if (typeof segmenter.processor !== "function") {
    await segmenter.dispose();
    throw new Error(`Model "${profile.modelId}" loaded without a usable processor`);
  }

  activePipeline = { modelId: request.modelId, inferencePath, segmenter };
  return { segmenter, loadMs: Math.round(performance.now() - startedAt) };
}

async function runInference(
  request: ModelLabProcessRequest,
  inferencePath: InferencePath,
): Promise<{
  matte: AlphaMatte;
  loadMs: number;
  inferenceMs: number;
}> {
  const { segmenter, loadMs } = await loadPipeline(request, inferencePath);
  post({
    type: "progress",
    requestId: request.requestId,
    modelId: request.modelId,
    stage: "processing",
    percent: null,
  });
  const startedAt = performance.now();
  const [segment] = await segmenter(request.source.blob);
  if (!segment) throw new Error("Model returned no segmentation mask");
  const data =
    segment.mask.data instanceof Uint8ClampedArray
      ? segment.mask.data
      : new Uint8ClampedArray(segment.mask.data);
  return {
    matte: { width: segment.mask.width, height: segment.mask.height, data },
    loadMs,
    inferenceMs: Math.round(performance.now() - startedAt),
  };
}

async function compositePreview(source: SourceImage, matte: AlphaMatte): Promise<Blob> {
  const bitmap = await createImageBitmap(source.blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Model lab: 2D OffscreenCanvas context unavailable");
    if (matte.width !== bitmap.width || matte.height !== bitmap.height) {
      throw new Error(
        `Model lab: matte dimensions ${String(matte.width)}x${String(matte.height)} do not match source ${String(bitmap.width)}x${String(bitmap.height)}`,
      );
    }
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    for (let pixel = 0; pixel < matte.data.length; pixel++) {
      imageData.data[pixel * 4 + 3] = matte.data[pixel] ?? 0;
    }
    context.clearRect(0, 0, bitmap.width, bitmap.height);
    context.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: "image/png" });
  } finally {
    bitmap.close();
  }
}

function measurementFor(
  request: ModelLabProcessRequest,
  input: Omit<BenchmarkMeasurement, "imageOrdinal" | "modelId" | "requestedPath">,
): BenchmarkMeasurement {
  return {
    imageOrdinal: request.imageOrdinal,
    modelId: request.modelId,
    requestedPath: request.inferencePath,
    ...input,
  };
}

async function handleProcess(request: ModelLabProcessRequest): Promise<void> {
  let actualPath = request.inferencePath;
  let fallbackReason: string | undefined;
  let failedAttemptMs = 0;
  const attemptStartedAt = performance.now();

  try {
    let inference;
    try {
      inference = await runInference(request, actualPath);
    } catch (error) {
      if (actualPath !== "webgpu" || !isWebGpuExecutionError(error)) throw error;
      failedAttemptMs = Math.round(performance.now() - attemptStartedAt);
      fallbackReason = toErrorMessage(error);
      actualPath = "wasm";
      inference = await runInference(request, actualPath);
    }

    const result = await compositePreview(request.source, inference.matte);
    post({
      type: "result",
      requestId: request.requestId,
      modelId: request.modelId,
      imageOrdinal: request.imageOrdinal,
      result,
      matte: inference.matte,
      measurement: measurementFor(request, {
        actualPath,
        status: "success",
        loadMs: inference.loadMs + failedAttemptMs,
        inferenceMs: inference.inferenceMs,
        ...(fallbackReason ? { fallbackReason } : {}),
      }),
    });
  } catch (error) {
    const code: EvaluationErrorCode = isOutOfMemoryError(error)
      ? "device-out-of-memory"
      : activePipeline
        ? "processing-failed"
        : "model-load-failed";
    post({
      type: "error",
      requestId: request.requestId,
      modelId: request.modelId,
      imageOrdinal: request.imageOrdinal,
      code,
      message: toErrorMessage(error),
      measurement: measurementFor(request, {
        actualPath,
        status: "error",
        loadMs: Math.round(performance.now() - attemptStartedAt),
        inferenceMs: 0,
        errorCode: code,
        ...(fallbackReason ? { fallbackReason } : {}),
      }),
    });
  }
}

workerScope.addEventListener("message", (event) => {
  const request = event.data;
  if (request.type === "cancel") {
    cancelled = true;
    void disposeActivePipeline();
    return;
  }
  cancelled = false;
  void handleProcess(request);
});
