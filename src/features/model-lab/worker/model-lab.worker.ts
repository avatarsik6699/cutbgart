import {
  AutoProcessor,
  env,
  pipeline,
  RawImage,
  Tensor,
  type ImageSegmentationPipeline,
  VitMatteForImageMatting,
} from "@huggingface/transformers";

import type {
  AlphaMatte,
  InferencePath,
  SourceImage,
} from "../../../entities/processed-image";
import {
  getEvaluationModel,
  getInteractiveEvaluationModel,
} from "../model/model-registry";
import { enforceTrimapConstraints } from "../model/trimap-preparation";
import type {
  BenchmarkMeasurement,
  EvaluationErrorCode,
  EvaluationModelId,
  InteractiveEvaluationErrorCode,
  InteractiveRuntimeMeasurement,
  ModelLabAnyWorkerResponse,
  ModelLabInteractiveProcessRequest,
  ModelLabProcessRequest,
  ModelLabWorkerRequest,
} from "../model/types";

interface WorkerScope {
  postMessage(message: ModelLabAnyWorkerResponse): void;
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
  kind: "automatic";
  modelId: EvaluationModelId;
  inferencePath: InferencePath;
  segmenter: ImageSegmentationPipeline;
}

interface MattingProcessor {
  (image: RawImage, trimap: RawImage): Promise<Record<string, Tensor>>;
}

interface ActiveMattingModel {
  kind: "matting";
  modelId: ModelLabInteractiveProcessRequest["modelId"];
  inferencePath: InferencePath;
  processor: MattingProcessor;
  model: {
    (inputs: Record<string, Tensor>): Promise<{ alphas: Tensor }>;
    dispose(): Promise<void>;
  };
}

let activePipeline: ActivePipeline | ActiveMattingModel | null = null;
let cancelled = false;

function post(response: ModelLabAnyWorkerResponse): void {
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
  if (!current) return;
  if (current.kind === "automatic") await current.segmenter.dispose();
  else await current.model.dispose();
}

async function loadPipeline(
  request: ModelLabProcessRequest,
  inferencePath: InferencePath,
): Promise<{ segmenter: ImageSegmentationPipeline; loadMs: number }> {
  if (
    activePipeline?.kind === "automatic" &&
    activePipeline.modelId === request.modelId &&
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

  activePipeline = {
    kind: "automatic",
    modelId: request.modelId,
    inferencePath,
    segmenter,
  };
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

function alphaMatteToImage(matte: AlphaMatte): RawImage {
  const rgba = new Uint8ClampedArray(matte.data.length * 4);
  for (let index = 0; index < matte.data.length; index += 1) {
    const value = matte.data[index] ?? 0;
    rgba[index * 4] = value;
    rgba[index * 4 + 1] = value;
    rgba[index * 4 + 2] = value;
    rgba[index * 4 + 3] = 255;
  }
  return RawImage.fromTensor(
    new Tensor("uint8", rgba, [matte.height, matte.width, 4]),
    "HWC",
  );
}

function resizeAlpha(
  data: Float32Array | Uint8Array | Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor((y * sourceHeight) / targetHeight),
    );
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor((x * sourceWidth) / targetWidth),
      );
      const value = data[sourceY * sourceWidth + sourceX] ?? 0;
      result[y * targetWidth + x] =
        data instanceof Float32Array
          ? Math.round(Math.max(0, Math.min(1, value)) * 255)
          : value;
    }
  }
  return result;
}

async function loadMattingModel(
  request: ModelLabInteractiveProcessRequest,
  inferencePath: InferencePath,
): Promise<{ resource: ActiveMattingModel; loadMs: number }> {
  if (
    activePipeline?.kind === "matting" &&
    activePipeline.modelId === request.modelId &&
    activePipeline.inferencePath === inferencePath
  ) {
    return { resource: activePipeline, loadMs: 0 };
  }
  await disposeActivePipeline();
  const profile = getInteractiveEvaluationModel(request.modelId);
  if (profile.eligibility === "rejected-license") {
    throw new Error(`license-rejected: ${profile.license}`);
  }
  if (profile.family !== "matting" || profile.supportedPaths.length === 0) {
    throw new Error(
      `operator-unsupported: ${profile.unsupportedReason ?? "No browser adapter"}`,
    );
  }
  if (!profile.supportedPaths.includes(inferencePath)) {
    throw new Error(`operator-unsupported: ${inferencePath}`);
  }

  env.remoteHost = upstreamRemoteHost;
  env.remotePathTemplate = `{model}/resolve/${profile.revision}/`;
  if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = upstreamWasmPaths;
  const startedAt = performance.now();
  const progress = (info: { status: string; progress?: number }) => {
    if (info.status !== "progress_total") return;
    post({
      type: "interactive-progress",
      requestId: request.requestId,
      modelId: request.modelId,
      stage: "loading",
      percent: info.progress ?? null,
    });
  };
  const [processor, loadedModel] = await Promise.all([
    AutoProcessor.from_pretrained(profile.modelId, {
      revision: profile.revision,
      progress_callback: progress,
    }),
    VitMatteForImageMatting.from_pretrained(profile.modelId, {
      revision: profile.revision,
      dtype: profile.dtype,
      device: inferencePath,
      progress_callback: progress,
    }),
  ]);
  const resource: ActiveMattingModel = {
    kind: "matting",
    modelId: request.modelId,
    inferencePath,
    processor,
    model: loadedModel as unknown as ActiveMattingModel["model"],
  };
  activePipeline = resource;
  return { resource, loadMs: Math.round(performance.now() - startedAt) };
}

async function runMattingInference(
  request: ModelLabInteractiveProcessRequest,
  inferencePath: InferencePath,
): Promise<{ matte: AlphaMatte; loadMs: number; inferenceMs: number }> {
  const { resource, loadMs } = await loadMattingModel(request, inferencePath);
  post({
    type: "interactive-progress",
    requestId: request.requestId,
    modelId: request.modelId,
    stage: "processing",
    percent: null,
  });
  const image = await RawImage.fromBlob(request.source.blob);
  const trimap = alphaMatteToImage(request.trimap);
  const inputs = await resource.processor(image, trimap);
  const startedAt = performance.now();
  const { alphas } = await resource.model(inputs);
  const inferenceMs = Math.round(performance.now() - startedAt);
  const height = alphas.dims.at(-2);
  const width = alphas.dims.at(-1);
  if (!height || !width) throw new Error("ViTMatte returned an invalid alpha tensor");
  const raw =
    alphas.data instanceof Float32Array ||
    alphas.data instanceof Uint8Array ||
    alphas.data instanceof Uint8ClampedArray
      ? alphas.data
      : Float32Array.from(alphas.data);
  const predicted: AlphaMatte = {
    width: request.source.width,
    height: request.source.height,
    data: resizeAlpha(raw, width, height, request.source.width, request.source.height),
  };
  return {
    matte: enforceTrimapConstraints(predicted, request.trimap),
    loadMs,
    inferenceMs,
  };
}

function interactiveMeasurementFor(
  request: ModelLabInteractiveProcessRequest,
  input: Omit<InteractiveRuntimeMeasurement, "caseOrdinal" | "modelId" | "requestedPath">,
): InteractiveRuntimeMeasurement {
  return {
    caseOrdinal: request.caseOrdinal,
    modelId: request.modelId,
    requestedPath: request.inferencePath,
    ...input,
  };
}

function classifyInteractiveError(error: unknown): InteractiveEvaluationErrorCode {
  const message = toErrorMessage(error);
  if (message.startsWith("license-rejected:")) return "license-rejected";
  if (message.startsWith("operator-unsupported:")) return "operator-unsupported";
  if (isOutOfMemoryError(error)) return "device-out-of-memory";
  return activePipeline ? "processing-failed" : "model-load-failed";
}

async function handleInteractiveProcess(
  request: ModelLabInteractiveProcessRequest,
): Promise<void> {
  let actualPath = request.inferencePath;
  let fallbackReason: string | undefined;
  let failedAttemptMs = 0;
  const attemptStartedAt = performance.now();
  try {
    let inference;
    try {
      inference = await runMattingInference(request, actualPath);
    } catch (error) {
      if (actualPath !== "webgpu" || !isWebGpuExecutionError(error)) throw error;
      failedAttemptMs = Math.round(performance.now() - attemptStartedAt);
      fallbackReason = toErrorMessage(error);
      actualPath = "wasm";
      inference = await runMattingInference(request, actualPath);
    }
    const result = await compositePreview(request.source, inference.matte);
    post({
      type: "interactive-result",
      requestId: request.requestId,
      modelId: request.modelId,
      caseOrdinal: request.caseOrdinal,
      result,
      matte: inference.matte,
      measurement: interactiveMeasurementFor(request, {
        actualPath,
        status: "success",
        coldLoadMs: inference.loadMs + failedAttemptMs,
        warmInferenceMs: inference.inferenceMs,
        peakMemoryBytes: null,
        memoryObservation: "unavailable",
        ...(fallbackReason ? { fallbackReason } : {}),
      }),
    });
  } catch (error) {
    const code = classifyInteractiveError(error);
    post({
      type: "interactive-error",
      requestId: request.requestId,
      modelId: request.modelId,
      caseOrdinal: request.caseOrdinal,
      code,
      message: toErrorMessage(error),
      measurement: interactiveMeasurementFor(request, {
        actualPath,
        status: code === "operator-unsupported" ? "unsupported" : "error",
        coldLoadMs: Math.round(performance.now() - attemptStartedAt),
        warmInferenceMs: 0,
        peakMemoryBytes: null,
        memoryObservation: "unavailable",
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
  if (request.type === "process-interactive") void handleInteractiveProcess(request);
  else void handleProcess(request);
});
