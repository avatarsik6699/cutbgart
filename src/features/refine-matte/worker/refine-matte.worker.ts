import {
  AutoProcessor,
  env,
  RawImage,
  Tensor,
  VitMatteForImageMatting,
} from "@huggingface/transformers";

import type {
  AlphaMatte,
  InferencePath,
  Trimap,
} from "../../../entities/processed-image";
import { env as appEnv } from "../../../shared/config";
import {
  createModelSourceLoader,
  type ModelSource,
} from "../../../shared/lib/model-source-loader";
import { deterministicRefinement } from "../model/deterministic-fusion";
import {
  MAX_MATTING_INPUT_PIXELS,
  MAX_MATTING_INPUT_SIDE,
  restoreRefinedCrop,
} from "../model/focus-crop";
import { getMattingModel } from "../model/model-registry";
import { nextMattingAttempt } from "../model/runtime-policy";
import type {
  MatteRefinementRequest,
  MatteRefinementWorkerRequest,
  MatteRefinementWorkerResponse,
  MattingRefinementError,
  MattingRefinementErrorCode,
  MattingRefinementMode,
} from "../model/types";

interface WorkerScope {
  postMessage(message: MatteRefinementWorkerResponse): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<MatteRefinementWorkerRequest>) => void,
  ): void;
}

interface MattingProcessor {
  (image: RawImage, trimap: RawImage): Promise<Record<string, Tensor>>;
}

interface ActiveModel {
  key: string;
  mode: MattingRefinementMode;
  path: InferencePath;
  processor: MattingProcessor;
  model: {
    (inputs: Record<string, Tensor>): Promise<{ alphas: Tensor }>;
    dispose(): Promise<void>;
  };
}

const scope = globalThis as unknown as WorkerScope;
const upstreamRemoteHost = env.remoteHost;
const upstreamWasmPaths = env.backends.onnx.wasm?.wasmPaths;
let pinnedRemotePathTemplate = "{model}/resolve/main/";
let activeModel: ActiveModel | null = null;
let activeRequestId: string | null = null;

env.useWasmCache = true;

function selectModelSource(source: ModelSource): void {
  env.remotePathTemplate = pinnedRemotePathTemplate;
  if (source === "cdn" && appEnv.modelCdnBaseUrl) {
    env.remoteHost = `${appEnv.modelCdnBaseUrl}/`;
    env.backends.onnx.wasm!.wasmPaths = `${appEnv.modelCdnBaseUrl}/onnxruntime-web/${appEnv.onnxRuntimeWebVersion}/`;
  } else {
    env.remoteHost = upstreamRemoteHost;
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = upstreamWasmPaths;
  }
}

const sourceLoader = createModelSourceLoader({
  cdnConfigured: Boolean(appEnv.modelCdnBaseUrl),
  selectSource: selectModelSource,
});

function post(message: MatteRefinementWorkerResponse): void {
  scope.postMessage(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDisposable(value: unknown): value is { dispose: () => void } {
  if (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof value.dispose === "function"
  ) {
    return true;
  }
  return false;
}

function disposeTensor(value: unknown): void {
  if (isDisposable(value)) value.dispose();
}

function isOutOfMemory(error: unknown): boolean {
  return /out of memory|oom|allocation failed|device was lost|bad_alloc/i.test(
    errorMessage(error),
  );
}

function isWebGpuError(error: unknown): boolean {
  return /ortrun|webgpu|shader_helper|storage buffers?|device lost|not supported/i.test(
    errorMessage(error),
  );
}

function classifyError(error: unknown, loading: boolean): MattingRefinementErrorCode {
  if (isOutOfMemory(error)) return "device-out-of-memory";
  if (isWebGpuError(error)) return "webgpu-failed";
  if (/operator|not implemented|unsupported op/i.test(errorMessage(error))) {
    return "operator-unsupported";
  }
  return loading ? "model-load-failed" : "processing-failed";
}

async function disposeActive(): Promise<void> {
  const current = activeModel;
  activeModel = null;
  if (current) await current.model.dispose();
}

async function loadModel(
  requestId: string,
  mode: MattingRefinementMode,
  path: InferencePath,
): Promise<ActiveModel> {
  const profile = getMattingModel(mode);
  const key = `${profile.id}:${path}`;
  if (activeModel?.key === key) return activeModel;
  await disposeActive();
  pinnedRemotePathTemplate = `{model}/resolve/${profile.revision}/`;
  selectModelSource(sourceLoader.current());
  const progress = (info: { status: string; progress?: number }) => {
    if (info.status === "progress_total" && activeRequestId === requestId) {
      post({
        type: "progress",
        requestId,
        stage: "loading",
        percent: info.progress ?? null,
      });
    }
  };
  const create = async () => {
    const [processor, model] = await Promise.all([
      AutoProcessor.from_pretrained(profile.modelId, {
        revision: profile.revision,
        progress_callback: progress,
      }),
      VitMatteForImageMatting.from_pretrained(profile.modelId, {
        revision: profile.revision,
        dtype: profile.dtype,
        device: path,
        progress_callback: progress,
      }),
    ]);
    return { processor, model };
  };
  const loaded = await sourceLoader.load(create);
  const resource: ActiveModel = {
    key,
    mode,
    path,
    processor: loaded.processor,
    model: loaded.model as unknown as ActiveModel["model"],
  };
  activeModel = resource;
  return resource;
}

function alphaToRawImage(matte: AlphaMatte | Trimap): RawImage {
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

async function cropSource(request: MatteRefinementRequest): Promise<Blob> {
  const bitmap = await createImageBitmap(request.source.blob);
  try {
    const canvas = new OffscreenCanvas(request.inputSize.width, request.inputSize.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D OffscreenCanvas is unavailable");
    context.drawImage(
      bitmap,
      request.crop.x,
      request.crop.y,
      request.crop.width,
      request.crop.height,
      0,
      0,
      request.inputSize.width,
      request.inputSize.height,
    );
    return canvas.convertToBlob({ type: "image/png" });
  } finally {
    bitmap.close();
  }
}

function cropTrimap(request: MatteRefinementRequest): Trimap {
  const { width, height } = request.inputSize;
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      request.crop.height - 1,
      Math.floor(((y + 0.5) * request.crop.height) / height),
    );
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        request.crop.width - 1,
        Math.floor(((x + 0.5) * request.crop.width) / width),
      );
      data[y * width + x] =
        request.trimap.data[
          (request.crop.y + sourceY) * request.trimap.width + request.crop.x + sourceX
        ] ?? 0;
    }
  }
  return {
    width,
    height,
    data,
    unknownBounds: { x: 0, y: 0, width, height },
  };
}

function validateInputSize(request: MatteRefinementRequest): void {
  const { width, height } = request.inputSize;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_MATTING_INPUT_SIDE ||
    height > MAX_MATTING_INPUT_SIDE ||
    width * height > MAX_MATTING_INPUT_PIXELS
  ) {
    throw new Error("ViTMatte input size exceeds the bounded inference budget");
  }
}

function predictedAlpha(alphas: Tensor): AlphaMatte {
  const height = alphas.dims.at(-2);
  const width = alphas.dims.at(-1);
  if (!height || !width) throw new Error("ViTMatte returned an invalid alpha tensor");
  const values = alphas.data as unknown as ArrayLike<number>;
  const data = new Uint8ClampedArray(width * height);
  const floatOutput = alphas.type === "float32" || alphas.type === "float16";
  for (let index = 0; index < data.length; index += 1) {
    const value = values[index] ?? 0;
    data[index] = floatOutput
      ? Math.round(Math.max(0, Math.min(1, value)) * 255)
      : Math.max(0, Math.min(255, Math.round(value)));
  }
  return { width, height, data };
}

async function infer(
  request: MatteRefinementRequest,
  mode: MattingRefinementMode,
  path: InferencePath,
): Promise<AlphaMatte> {
  validateInputSize(request);
  const resource = await loadModel(request.requestId, mode, path).catch((error) => {
    throw new Error(errorMessage(error), { cause: error });
  });
  if (activeRequestId !== request.requestId) throw new Error("cancelled");
  post({
    type: "progress",
    requestId: request.requestId,
    stage: "refining",
    percent: null,
  });
  const image = await RawImage.fromBlob(await cropSource(request));
  const trimap = alphaToRawImage(cropTrimap(request));
  const inputs = await resource.processor(image, trimap);
  let alphas: Tensor | null = null;
  try {
    ({ alphas } = await resource.model(inputs));
    if (activeRequestId !== request.requestId) throw new Error("cancelled");
    return restoreRefinedCrop({
      predicted: predictedAlpha(alphas),
      prior: request.priorMatte,
      trimap: request.trimap,
      crop: request.crop,
      constraints: request.constraints,
    });
  } catch (error) {
    throw new Error(errorMessage(error), { cause: error });
  } finally {
    disposeTensor(alphas);
    Object.values(inputs).forEach(disposeTensor);
  }
}

function deterministicResult(request: MatteRefinementRequest) {
  return deterministicRefinement({
    priorMatte: request.priorMatte,
    guidedMatte: request.guidedMatte,
    trimap: request.trimap,
    constraints: request.constraints,
  });
}

async function handleRefine(request: MatteRefinementRequest): Promise<void> {
  activeRequestId = request.requestId;
  let mode = request.requestedMode;
  let path = request.requestedPath;
  let fallback: "none" | "balanced" | "wasm" = "none";
  try {
    let matte: AlphaMatte | null = null;
    while (!matte) {
      try {
        matte = await infer(request, mode, path);
      } catch (attemptError) {
        if (errorMessage(attemptError) === "cancelled") throw attemptError;
        const fromMode = mode;
        const fromPath = path;
        const next = nextMattingAttempt({ mode, path }, isWebGpuError(attemptError));
        if (!next) throw attemptError;
        await disposeActive();
        mode = next.mode;
        path = next.path;
        if (fromMode === "maximum") fallback = "balanced";
        else if (fromPath === "webgpu" && path === "wasm") fallback = "wasm";
        post({
          type: "fallback",
          requestId: request.requestId,
          from: fromMode,
          to: mode,
          fromPath,
          toPath: path,
          reason: errorMessage(attemptError),
        });
      }
    }
    if (activeRequestId !== request.requestId) return;
    post({
      type: "result",
      requestId: request.requestId,
      result: {
        matte,
        requestedMode: request.requestedMode,
        actualMode: mode,
        actualPath: path,
        inputSize: request.inputSize,
        fallback,
      },
    });
  } catch (error) {
    if (activeRequestId !== request.requestId || errorMessage(error) === "cancelled")
      return;
    await disposeActive();
    post({
      type: "result",
      requestId: request.requestId,
      result: {
        matte: deterministicResult(request),
        requestedMode: request.requestedMode,
        actualMode: "deterministic",
        actualPath: null,
        inputSize: request.inputSize,
        fallback: "deterministic",
        fallbackReason: errorMessage(error),
      },
    });
  }
}

scope.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "refine") {
    void handleRefine(message.request).catch((error: unknown) => {
      const detail: MattingRefinementError = {
        code: classifyError(error, false),
        message: errorMessage(error),
        recoverable: true,
      };
      post({ type: "error", requestId: message.request.requestId, error: detail });
    });
    return;
  }
  if (activeRequestId === message.requestId || message.type === "dispose") {
    activeRequestId = null;
  }
  void disposeActive().then(() => {
    if (message.type === "dispose") {
      post({ type: "disposed", requestId: message.requestId });
    }
  });
});
