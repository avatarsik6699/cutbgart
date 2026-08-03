import { env, pipeline, type ImageSegmentationPipeline } from "@huggingface/transformers";

import { createModelSourceLoader, type ModelSource } from "@/shared/lib";

import type { LocalModelConfig } from "../model-config";
import { resolveUsableInferencePath } from "../browser-capabilities";
import {
  PROCESSING_WORKER_PROTOCOL_VERSION,
  sameCorrelation,
  type ProcessingWorkerCommand,
  type ProcessingWorkerEvent,
  type StageTiming,
  type TransferableArtifactSet,
} from "../worker-protocol";
import { applyMatte } from "../../image-processing";
import { isWebGpuFailure, normalizeProcessingError } from "./processing-error-policy";

type WorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ProcessingWorkerCommand>) => void,
  ): void;
  postMessage(message: ProcessingWorkerEvent, transfer?: Transferable[]): void;
};

type ActiveRun = {
  cancelled: boolean;
  command: Extract<ProcessingWorkerCommand, { type: "RUN" }>;
  terminal: boolean;
  timings: StageTiming[];
};

type CachedSegmenter = {
  key: string;
  segmenter: ImageSegmentationPipeline;
};

const workerScope = globalThis as unknown as WorkerScope;
const upstreamRemoteHost = env.remoteHost;
const upstreamWasmPaths = env.backends.onnx.wasm?.wasmPaths;

env.useWasmCache = true;

let activeRun: ActiveRun | null = null;
let cachedSegmenter: CachedSegmenter | null = null;
let disposeRequested = false;
let selectedConfig: LocalModelConfig | null = null;

function post(event: ProcessingWorkerEvent, transfer?: Transferable[]): void {
  workerScope.postMessage(event, transfer);
}

function selectModelSource(source: ModelSource): void {
  const config = selectedConfig;
  if (config === null) {
    return;
  }
  env.remotePathTemplate = `{model}/resolve/${config.revision}/`;
  if (source === "cdn" && config.cdnBaseUrl !== undefined) {
    env.remoteHost = `${config.cdnBaseUrl}/`;
    env.backends.onnx.wasm!.wasmPaths = `${config.cdnBaseUrl}/onnxruntime-web/${config.onnxRuntimeWebVersion}/`;
    return;
  }
  env.remoteHost = upstreamRemoteHost;
  env.backends.onnx.wasm!.wasmPaths = upstreamWasmPaths;
}

function throwIfCancelled(run: ActiveRun): void {
  if (run.cancelled) {
    throw new DOMException("Processing was cancelled", "AbortError");
  }
}

async function measured<T>(
  run: ActiveRun,
  stage: StageTiming["stage"],
  operation: () => Promise<T> | T,
): Promise<T> {
  throwIfCancelled(run);
  const startedAt = performance.now();
  post({
    protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
    type: "PROGRESS",
    correlation: run.command.correlation,
    stage,
    fraction: null,
    timing: null,
  });
  const result = await operation();
  const timing = {
    stage,
    durationMs: performance.now() - startedAt,
  } satisfies StageTiming;
  run.timings.push(timing);
  post({
    protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
    type: "PROGRESS",
    correlation: run.command.correlation,
    stage,
    fraction: 1,
    timing,
  });
  throwIfCancelled(run);
  return result;
}

async function disposeSegmenter(): Promise<void> {
  const current = cachedSegmenter;
  cachedSegmenter = null;
  if (current !== null) {
    await current.segmenter.dispose();
  }
}

async function createSegmenter(
  config: LocalModelConfig,
): Promise<ImageSegmentationPipeline> {
  const key = `${config.modelId}:${config.revision}:${config.dtype}:${config.inferencePath}`;
  if (cachedSegmenter?.key === key) {
    return cachedSegmenter.segmenter;
  }
  await disposeSegmenter();
  selectedConfig = config;
  const sourceLoader = createModelSourceLoader({
    cdnConfigured: config.cdnBaseUrl !== undefined,
    selectSource: selectModelSource,
  });
  const segmenter = await sourceLoader.load(async () => {
    const candidate = await pipeline("image-segmentation", config.modelId, {
      revision: config.revision,
      dtype: config.dtype,
      device: config.inferencePath,
    });
    if (typeof candidate.processor !== "function") {
      await candidate.dispose();
      throw new Error("Model loaded without a usable image processor");
    }
    return candidate;
  });
  cachedSegmenter = { key, segmenter };
  return segmenter;
}

async function runPipeline(run: ActiveRun): Promise<TransferableArtifactSet> {
  const source = new Blob([run.command.source.bytes], {
    type: run.command.source.mediaType,
  });
  const requestedModel = run.command.model;
  const model = {
    ...requestedModel,
    inferencePath: await resolveUsableInferencePath(requestedModel.inferencePath),
  };
  const segmenter = await measured(run, "model-loading", async () => {
    try {
      return await createSegmenter(model);
    } catch (error) {
      if (model.inferencePath !== "webgpu" || !isWebGpuFailure(error)) {
        throw error;
      }
      await disposeSegmenter();
      return createSegmenter({ ...model, inferencePath: "wasm" });
    }
  });
  const output = await measured(run, "automatic-remove", async () => {
    try {
      return await segmenter(source);
    } catch (error) {
      if (model.inferencePath !== "webgpu" || !isWebGpuFailure(error)) {
        throw error;
      }
      await disposeSegmenter();
      const fallback = await createSegmenter({
        ...model,
        inferencePath: "wasm",
      });
      return fallback(source);
    }
  });
  const matte = await measured(run, "post-process", () => {
    const first = output[0];
    if (first === undefined) {
      throw new Error("Model returned no segmentation matte");
    }
    if (
      first.mask.width !== run.command.source.width ||
      first.mask.height !== run.command.source.height
    ) {
      throw new Error("Model returned a matte with unexpected dimensions");
    }
    return first.mask.data instanceof Uint8ClampedArray
      ? first.mask.data
      : new Uint8ClampedArray(first.mask.data);
  });
  const bitmap = await measured(run, "decode", () => createImageBitmap(source));
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("OffscreenCanvas 2D context is unavailable");
    }
    await measured(run, "composite", () => {
      context.drawImage(bitmap, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      applyMatte(imageData, matte);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.putImageData(imageData, 0, 0);
    });
    const png = await measured(run, "encode-png", () =>
      canvas.convertToBlob({ type: "image/png" }),
    );
    return {
      matte: matte.slice().buffer,
      compositePng: await png.arrayBuffer(),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}

async function finishRun(run: ActiveRun): Promise<void> {
  try {
    const outputs = await runPipeline(run);
    throwIfCancelled(run);
    run.terminal = true;
    post(
      {
        protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
        type: "SUCCEEDED",
        correlation: run.command.correlation,
        outputs,
        timings: run.timings,
      },
      [outputs.matte, outputs.compositePng],
    );
  } catch (error) {
    if (run.terminal) {
      return;
    }
    run.terminal = true;
    if (run.cancelled || (error instanceof DOMException && error.name === "AbortError")) {
      post({
        protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
        type: "CANCELLED",
        correlation: run.command.correlation,
        timings: run.timings,
      });
    } else {
      post({
        protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
        type: "FAILED",
        correlation: run.command.correlation,
        error: normalizeProcessingError(error, run.timings.length === 0),
        timings: run.timings,
      });
    }
  } finally {
    if (activeRun === run) {
      activeRun = null;
    }
    if (disposeRequested) {
      await finishDispose();
    }
  }
}

async function finishDispose(): Promise<void> {
  if (activeRun !== null) {
    activeRun.cancelled = true;
    return;
  }
  disposeRequested = false;
  await disposeSegmenter();
  post({ protocol: PROCESSING_WORKER_PROTOCOL_VERSION, type: "DISPOSED" });
}

workerScope.addEventListener("message", (messageEvent) => {
  const command = messageEvent.data;
  if (command.protocol !== PROCESSING_WORKER_PROTOCOL_VERSION) {
    return;
  }
  if (command.type === "DISPOSE_RUNTIME") {
    disposeRequested = true;
    void finishDispose();
    return;
  }
  if (command.type === "CANCEL") {
    if (
      activeRun !== null &&
      sameCorrelation(activeRun.command.correlation, command.correlation)
    ) {
      activeRun.cancelled = true;
    }
    return;
  }
  if (activeRun !== null) {
    post({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: command.correlation,
      error: {
        code: "invalid-request",
        message: "Only one heavy local processing run may be active",
        retryable: true,
      },
      timings: [],
    });
    return;
  }
  const run: ActiveRun = { cancelled: false, command, terminal: false, timings: [] };
  activeRun = run;
  post({
    protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
    type: "ACCEPTED",
    correlation: command.correlation,
  });
  void finishRun(run);
});
