import {
  AutoProcessor,
  env,
  RawImage,
  Tensor,
  VitMatteForImageMatting,
} from "@huggingface/transformers";

import { env as appEnv } from "@/shared/config";
import {
  createModelSourceLoader,
  getMattingModel,
  type BrowserInferencePath,
  type MattingRefinementMode,
  type ModelSource,
} from "@/shared/lib";
import type { ProcessingError, ProcessingErrorCode } from "@/editor/domain";

import { removeColourHalo } from "../colour-halo.policy";
import type { EnhancementPixelTypes } from "../enhancement-pixels.types";
import {
  buildRefinementTrimap,
  computeMattingInputSize,
  computeRefinementCrop,
  deterministicRefinement,
  nextMattingAttempt,
  restoreRefinedCrop,
  sameAlphaPlane,
} from "../fine-detail.policy";
import {
  ENHANCEMENT_WORKER_PROTOCOL_VERSION,
  sameEnhancementCorrelation,
  type EnhancementRunCorrelation,
  type EnhancementWorkerCommand,
  type EnhancementWorkerEvent,
} from "../enhancement-worker-protocol";

type RunCommand = Extract<EnhancementWorkerCommand, { type: "RUN" }>;
type FineDetailCommand = Extract<
  RunCommand,
  { correlation: { operationId: "fine-detail" } }
>;
type ColourHaloCommand = Extract<
  RunCommand,
  { correlation: { operationId: "colour-halo" } }
>;

type WorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<EnhancementWorkerCommand>) => void,
  ): void;
  postMessage(message: EnhancementWorkerEvent, transfer?: Transferable[]): void;
};

type MattingProcessor = (
  image: RawImage,
  trimap: RawImage,
) => Promise<Record<string, Tensor>>;

type ActiveModel = {
  key: string;
  mode: MattingRefinementMode;
  path: BrowserInferencePath;
  processor: MattingProcessor;
  model: {
    (inputs: Record<string, Tensor>): Promise<{ alphas: Tensor }>;
    dispose(): Promise<void>;
  };
};

const scope = globalThis as unknown as WorkerScope;
const upstreamRemoteHost = env.remoteHost;
const upstreamWasmPaths = env.backends.onnx.wasm?.wasmPaths;
let pinnedRemotePathTemplate = "{model}/resolve/main/";
let activeCorrelation: EnhancementRunCorrelation | null = null;
let activeModel: ActiveModel | null = null;

env.useWasmCache = true;

function post(message: EnhancementWorkerEvent, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer);
}

function selectModelSource(source: ModelSource): void {
  env.remotePathTemplate = pinnedRemotePathTemplate;
  if (source === "cdn" && appEnv.modelCdnBaseUrl) {
    env.remoteHost = `${appEnv.modelCdnBaseUrl}/`;
    if (env.backends.onnx.wasm)
      env.backends.onnx.wasm.wasmPaths = `${appEnv.modelCdnBaseUrl}/onnxruntime-web/${appEnv.onnxRuntimeWebVersion}/`;
    return;
  }
  env.remoteHost = upstreamRemoteHost;
  if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = upstreamWasmPaths;
}

const sourceLoader = createModelSourceLoader({
  cdnConfigured: Boolean(appEnv.modelCdnBaseUrl),
  selectSource: selectModelSource,
});

function isCurrent(correlation: EnhancementRunCorrelation): boolean {
  return (
    activeCorrelation !== null &&
    sameEnhancementCorrelation(activeCorrelation, correlation)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function processingError(error: unknown, loading = false): ProcessingError {
  const message = errorMessage(error);
  let code: ProcessingErrorCode = loading ? "model-load-failed" : "processing-failed";
  if (isOutOfMemory(error)) code = "device-out-of-memory";
  else if (/operator|not implemented|unsupported op/i.test(message))
    code = "operator-unsupported";
  return { code, message, retryable: true };
}

function transferable(data: Uint8ClampedArray): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
}

function matte(command: RunCommand): EnhancementPixelTypes.AlphaPlane {
  const data = new Uint8ClampedArray(command.matte);
  if (
    command.width <= 0 ||
    command.height <= 0 ||
    data.length !== command.width * command.height
  ) {
    throw new Error("Enhancement matte dimensions are invalid");
  }
  return { width: command.width, height: command.height, data };
}

function disposable(value: unknown): value is { dispose(): void } {
  return (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof value.dispose === "function"
  );
}

async function disposeModel(): Promise<void> {
  const model = activeModel;
  activeModel = null;
  if (model !== null) await model.model.dispose();
}

async function loadModel(
  command: FineDetailCommand,
  mode: MattingRefinementMode,
  path: BrowserInferencePath,
): Promise<ActiveModel> {
  const profile = getMattingModel(mode);
  const key = `${profile.id}:${path}`;
  if (activeModel?.key === key) return activeModel;
  await disposeModel();
  pinnedRemotePathTemplate = `{model}/resolve/${profile.revision}/`;
  selectModelSource(sourceLoader.current());
  const progress = (info: { status: string; progress?: number }): void => {
    if (info.status !== "progress_total" || !isCurrent(command.correlation)) return;
    post({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation: command.correlation,
      stage: "enhancement-model-loading",
      fraction:
        typeof info.progress === "number"
          ? Math.max(0, Math.min(1, info.progress / 100))
          : null,
    });
  };
  const loaded = await sourceLoader.load(async () => {
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
  });
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

function alphaImage(
  matteValue: EnhancementPixelTypes.AlphaPlane | EnhancementPixelTypes.Trimap,
): RawImage {
  const rgba = new Uint8ClampedArray(matteValue.data.length * 4);
  for (let index = 0; index < matteValue.data.length; index += 1) {
    const value = matteValue.data[index] ?? 0;
    rgba[index * 4] = value;
    rgba[index * 4 + 1] = value;
    rgba[index * 4 + 2] = value;
    rgba[index * 4 + 3] = 255;
  }
  return RawImage.fromTensor(
    new Tensor("uint8", rgba, [matteValue.height, matteValue.width, 4]),
    "HWC",
  );
}

async function cropSource(
  command: FineDetailCommand,
  crop: EnhancementPixelTypes.Rect,
  size: { width: number; height: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(
    new Blob([command.source.bytes], { type: command.source.mediaType }),
  );
  try {
    if (bitmap.width !== command.width || bitmap.height !== command.height)
      throw new Error("Enhancement source dimensions changed");
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Enhancement crop canvas is unavailable");
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size.width,
      size.height,
    );
    return canvas.convertToBlob({ type: "image/png" });
  } finally {
    bitmap.close();
  }
}

function resizeTrimap(
  trimap: EnhancementPixelTypes.Trimap,
  crop: EnhancementPixelTypes.Rect,
  size: { width: number; height: number },
): EnhancementPixelTypes.Trimap {
  const data = new Uint8ClampedArray(size.width * size.height);
  for (let y = 0; y < size.height; y += 1) {
    const sourceY = Math.min(
      crop.height - 1,
      Math.floor(((y + 0.5) * crop.height) / size.height),
    );
    for (let x = 0; x < size.width; x += 1) {
      const sourceX = Math.min(
        crop.width - 1,
        Math.floor(((x + 0.5) * crop.width) / size.width),
      );
      data[y * size.width + x] =
        trimap.data[(crop.y + sourceY) * trimap.width + crop.x + sourceX] ?? 0;
    }
  }
  return {
    width: size.width,
    height: size.height,
    data,
    unknownBounds: { x: 0, y: 0, width: size.width, height: size.height },
  };
}

function predictedAlpha(alphas: Tensor): EnhancementPixelTypes.AlphaPlane {
  const height = alphas.dims.at(-2);
  const width = alphas.dims.at(-1);
  if (height === undefined || width === undefined || height <= 0 || width <= 0)
    throw new Error("ViTMatte returned an invalid alpha tensor");
  const values = alphas.data as unknown as ArrayLike<number>;
  const data = new Uint8ClampedArray(width * height);
  const floating = alphas.type === "float32" || alphas.type === "float16";
  for (let index = 0; index < data.length; index += 1) {
    const value = values[index] ?? 0;
    data[index] = floating
      ? Math.round(Math.max(0, Math.min(1, value)) * 255)
      : Math.max(0, Math.min(255, Math.round(value)));
  }
  return { width, height, data };
}

async function inferFineDetail(
  command: FineDetailCommand,
  prior: EnhancementPixelTypes.AlphaPlane,
  trimap: EnhancementPixelTypes.Trimap,
  crop: EnhancementPixelTypes.Rect,
  mode: MattingRefinementMode,
  path: BrowserInferencePath,
): Promise<EnhancementPixelTypes.AlphaPlane> {
  const size = computeMattingInputSize(crop);
  const resource = await loadModel(command, mode, path);
  if (!isCurrent(command.correlation)) throw new DOMException("Cancelled", "AbortError");
  post({
    protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
    type: "PROGRESS",
    correlation: command.correlation,
    stage: "enhancement-fine-detail",
    fraction: null,
  });
  const source = await RawImage.fromBlob(await cropSource(command, crop, size));
  const trimapImage = alphaImage(resizeTrimap(trimap, crop, size));
  const inputs = await resource.processor(source, trimapImage);
  let alphas: Tensor | null = null;
  try {
    ({ alphas } = await resource.model(inputs));
    if (!isCurrent(command.correlation))
      throw new DOMException("Cancelled", "AbortError");
    return restoreRefinedCrop({
      predicted: predictedAlpha(alphas),
      prior,
      trimap,
      crop,
    });
  } finally {
    if (disposable(alphas)) alphas.dispose();
    for (const value of Object.values(inputs)) if (disposable(value)) value.dispose();
  }
}

async function fineDetail(command: FineDetailCommand): Promise<void> {
  const prior = matte(command);
  const trimap = buildRefinementTrimap(prior);
  const crop = computeRefinementCrop(trimap);
  if (crop === null) {
    const result = deterministicRefinement(prior, trimap);
    const output = transferable(result.data);
    post(
      {
        protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
        type: "SUCCEEDED",
        correlation: command.correlation,
        output: {
          operationId: "fine-detail",
          matte: output,
          changed: !sameAlphaPlane(prior, result),
          actualMode: "deterministic",
          actualPath: null,
          fallback: "deterministic",
        },
      },
      [output],
    );
    return;
  }
  let mode = command.requestedMode;
  let path = command.requestedPath;
  let fallback: "none" | "balanced" | "wasm" = "none";
  let result: EnhancementPixelTypes.AlphaPlane | null = null;
  while (result === null) {
    try {
      result = await inferFineDetail(command, prior, trimap, crop, mode, path);
    } catch (error) {
      if (!isCurrent(command.correlation)) return;
      const previousMode = mode;
      const previousPath = path;
      const next = nextMattingAttempt({ mode, path }, isWebGpuError(error));
      if (next === null) {
        const deterministic = deterministicRefinement(prior, trimap);
        const output = transferable(deterministic.data);
        post(
          {
            protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
            type: "SUCCEEDED",
            correlation: command.correlation,
            output: {
              operationId: "fine-detail",
              matte: output,
              changed: !sameAlphaPlane(prior, deterministic),
              actualMode: "deterministic",
              actualPath: null,
              fallback: "deterministic",
            },
          },
          [output],
        );
        return;
      }
      await disposeModel();
      mode = next.mode;
      path = next.path;
      fallback = previousMode === "maximum" ? "balanced" : "wasm";
      if (previousPath === path && previousMode === mode) throw error;
    }
  }
  const output = transferable(result.data);
  post(
    {
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: command.correlation,
      output: {
        operationId: "fine-detail",
        matte: output,
        changed: !sameAlphaPlane(prior, result),
        actualMode: mode,
        actualPath: path,
        fallback,
      },
    },
    [output],
  );
}

async function colourHalo(command: ColourHaloCommand): Promise<void> {
  post({
    protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
    type: "PROGRESS",
    correlation: command.correlation,
    stage: "enhancement-colour-halo",
    fraction: null,
  });
  const bitmap = await createImageBitmap(
    new Blob([command.source.bytes], { type: command.source.mediaType }),
  );
  try {
    if (bitmap.width !== command.width || bitmap.height !== command.height)
      throw new Error("Colour-halo source dimensions changed");
    const canvas = new OffscreenCanvas(command.width, command.height);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Colour-halo canvas is unavailable");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, command.width, command.height);
    const result = removeColourHalo(pixels.data, matte(command));
    let foregroundPng: ArrayBuffer | null = null;
    if (result.changed) {
      pixels.data.set(result.rgba);
      context.putImageData(pixels, 0, 0);
      foregroundPng = await (
        await canvas.convertToBlob({ type: "image/png" })
      ).arrayBuffer();
    }
    const matteOutput = transferable(result.matte.data);
    post(
      {
        protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
        type: "SUCCEEDED",
        correlation: command.correlation,
        output: {
          operationId: "colour-halo",
          matte: matteOutput,
          foregroundPng,
          changed: result.changed,
          actualPath: result.actualPath,
          fallback: result.fallback,
        },
      },
      [matteOutput, ...(foregroundPng === null ? [] : [foregroundPng])],
    );
  } finally {
    bitmap.close();
  }
}

async function run(command: RunCommand): Promise<void> {
  if (activeCorrelation !== null) {
    post({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: command.correlation,
      error: {
        code: "invalid-request",
        message: "An enhancement operation is already active",
        retryable: true,
      },
    });
    return;
  }
  activeCorrelation = command.correlation;
  post({
    protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
    type: "ACCEPTED",
    correlation: command.correlation,
  });
  try {
    if (command.correlation.operationId === "fine-detail")
      await fineDetail(command as FineDetailCommand);
    else await colourHalo(command as ColourHaloCommand);
  } catch (error) {
    if (!isCurrent(command.correlation)) return;
    post({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: command.correlation,
      error: processingError(error),
    });
  } finally {
    if (isCurrent(command.correlation)) activeCorrelation = null;
  }
}

scope.addEventListener("message", (event) => {
  const command = event.data;
  if (command.protocol !== ENHANCEMENT_WORKER_PROTOCOL_VERSION) return;
  if (command.type === "RUN") {
    void run(command);
    return;
  }
  if (command.type === "CANCEL") {
    if (isCurrent(command.correlation)) {
      activeCorrelation = null;
      post({
        protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
        type: "CANCELLED",
        correlation: command.correlation,
      });
      void disposeModel();
    }
    return;
  }
  activeCorrelation = null;
  void disposeModel().then(() => {
    post({ protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION, type: "DISPOSED" });
  });
});
