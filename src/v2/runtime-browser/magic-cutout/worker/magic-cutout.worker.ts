import {
  AutoProcessor,
  env as transformersEnv,
  RawImage,
  SamModel,
  Tensor,
  type SamProcessor,
} from "@huggingface/transformers";

import { env as appEnv } from "@/shared/config";
import { GUIDED_MODEL } from "@/shared/lib/inference/production-model-config";
import type { ProcessingError, ProcessingErrorCode } from "@/v2/domain";

import { createMagicModelPrompts } from "../magic-prompt-policy";
import {
  MAGIC_WORKER_PROTOCOL_VERSION,
  sameMagicCorrelation,
  type MagicPredictionStage,
  type MagicWorkerCommand,
  type MagicWorkerEvent,
  type TransferableMagicCandidate,
} from "../magic-worker-protocol";

type WorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<MagicWorkerCommand>) => void,
  ): void;
  postMessage(message: MagicWorkerEvent, transfer?: Transferable[]): void;
};

type Encoding = {
  cacheKey: string;
  imageEmbeddings: Tensor;
  imagePositionalEmbeddings: Tensor;
  originalSizes: [number, number][];
  pixelValues: Tensor;
  reshapedInputSizes: [number, number][];
};

type SamInputs = {
  original_sizes: [number, number][];
  pixel_values: Tensor;
  reshaped_input_sizes: [number, number][];
};

type SamOutputs = { iou_scores: Tensor; pred_masks: Tensor };

class PredictionCancelled extends Error {}

const scope = globalThis as unknown as WorkerScope;
const upstreamRemoteHost = transformersEnv.remoteHost;
const upstreamWasmPaths = transformersEnv.backends.onnx.wasm?.wasmPaths;
transformersEnv.useWasmCache = true;
transformersEnv.remotePathTemplate = `{model}/resolve/${GUIDED_MODEL.revision}/`;
if (appEnv.modelCdnBaseUrl) {
  transformersEnv.remoteHost = `${appEnv.modelCdnBaseUrl}/`;
  transformersEnv.backends.onnx.wasm!.wasmPaths = `${appEnv.modelCdnBaseUrl}/onnxruntime-web/${appEnv.onnxRuntimeWebVersion}/`;
}

let model: SamModel | null = null;
let processor: SamProcessor | null = null;
let encoding: Encoding | null = null;
let active: {
  cancelled: boolean;
  correlation: Extract<MagicWorkerCommand, { type: "PREDICT" }>["correlation"];
} | null = null;
let activeTask: Promise<void> | null = null;

function post(message: MagicWorkerEvent, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer);
}

function errorDetail(
  code: ProcessingErrorCode,
  error: unknown,
  retryable = true,
): ProcessingError {
  return {
    code,
    message: error instanceof Error ? error.message : String(error),
    retryable,
  };
}

function progress(
  command: Extract<MagicWorkerCommand, { type: "PREDICT" }>,
  stage: MagicPredictionStage,
  fraction: number | null,
): void {
  post({
    protocol: MAGIC_WORKER_PROTOCOL_VERSION,
    type: "PROGRESS",
    correlation: command.correlation,
    stage,
    fraction,
  });
}

function assertCurrent(request: NonNullable<typeof active>): void {
  if (active !== request || request.cancelled) throw new PredictionCancelled();
}

function exactModelProfile(
  command: Extract<MagicWorkerCommand, { type: "PREDICT" }>,
): boolean {
  const profile = command.model;
  return (
    profile.modelId === GUIDED_MODEL.modelId &&
    profile.revision === GUIDED_MODEL.revision &&
    profile.dtype === GUIDED_MODEL.dtype &&
    profile.approximateBytes === GUIDED_MODEL.approximateBytes &&
    profile.license === GUIDED_MODEL.license &&
    profile.supportedPaths.length === 1 &&
    profile.supportedPaths[0] === "wasm"
  );
}

function disposeEncoding(): void {
  encoding?.pixelValues.dispose();
  encoding?.imageEmbeddings.dispose();
  encoding?.imagePositionalEmbeddings.dispose();
  encoding = null;
}

async function disposeRuntime(): Promise<void> {
  disposeEncoding();
  await model?.dispose();
  model = null;
  processor = null;
}

async function loadRuntime(
  command: Extract<MagicWorkerCommand, { type: "PREDICT" }>,
  request: NonNullable<typeof active>,
): Promise<{ model: SamModel; processor: SamProcessor }> {
  if (model !== null && processor !== null) return { model, processor };
  progress(command, "magic-model-loading", 0);
  const options = {
    revision: GUIDED_MODEL.revision,
    dtype: GUIDED_MODEL.dtype,
    device: "wasm" as const,
    progress_callback(info: { status: string; progress?: number }): void {
      if (info.status !== "progress_total" || active !== request || request.cancelled)
        return;
      const raw = info.progress ?? 0;
      progress(
        command,
        "magic-model-loading",
        Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw)),
      );
    },
  };
  try {
    [model, processor] = (await Promise.all([
      SamModel.from_pretrained(GUIDED_MODEL.modelId, options),
      AutoProcessor.from_pretrained(GUIDED_MODEL.modelId, {
        revision: GUIDED_MODEL.revision,
      }),
    ])) as [SamModel, SamProcessor];
  } catch (cdnError) {
    transformersEnv.remoteHost = upstreamRemoteHost;
    if (transformersEnv.backends.onnx.wasm) {
      transformersEnv.backends.onnx.wasm.wasmPaths = upstreamWasmPaths;
    }
    [model, processor] = (await Promise.all([
      SamModel.from_pretrained(GUIDED_MODEL.modelId, options),
      AutoProcessor.from_pretrained(GUIDED_MODEL.modelId, {
        revision: GUIDED_MODEL.revision,
      }),
    ]).catch((error) => {
      throw new Error(`${String(error)} (CDN attempt: ${String(cdnError)})`);
    })) as [SamModel, SamProcessor];
  }
  assertCurrent(request);
  return { model, processor };
}

async function encodeSource(
  command: Extract<MagicWorkerCommand, { type: "PREDICT" }>,
  request: NonNullable<typeof active>,
  runtime: { model: SamModel; processor: SamProcessor },
): Promise<Encoding> {
  const cacheKey = [
    command.correlation.documentId,
    command.correlation.expectedRevision,
    command.source.width,
    command.source.height,
  ].join(":");
  if (encoding?.cacheKey === cacheKey) return encoding;
  disposeEncoding();
  progress(command, "magic-encode", null);
  const image = await RawImage.read(
    new Blob([command.source.bytes], { type: command.source.mediaType }),
  );
  assertCurrent(request);
  const rawInputs: unknown = await runtime.processor(image);
  const inputs = rawInputs as SamInputs;
  const embeddings = await runtime.model.get_image_embeddings({
    pixel_values: inputs.pixel_values,
  });
  assertCurrent(request);
  encoding = {
    cacheKey,
    pixelValues: inputs.pixel_values,
    originalSizes: inputs.original_sizes,
    reshapedInputSizes: inputs.reshaped_input_sizes,
    imageEmbeddings: embeddings.image_embeddings,
    imagePositionalEmbeddings: embeddings.image_positional_embeddings,
  };
  return encoding;
}

function candidateBuffers(
  masks: Tensor,
  scores: Tensor,
  width: number,
  height: number,
): readonly TransferableMagicCandidate[] {
  const pixelCount = width * height;
  const count = Math.min(scores.data.length, Math.floor(masks.data.length / pixelCount));
  if (count === 0) throw new Error("SlimSAM returned no mask candidates");
  return Array.from({ length: count }, (_unused, candidateIndex) => {
    const data = new Uint8ClampedArray(pixelCount);
    const offset = candidateIndex * pixelCount;
    for (let index = 0; index < pixelCount; index += 1) {
      data[index] = Number(masks.data[offset + index]) === 0 ? 0 : 255;
    }
    return {
      data: data.buffer,
      height,
      score: Number(scores.data[candidateIndex] ?? 0),
      width,
    };
  });
}

async function predict(
  command: Extract<MagicWorkerCommand, { type: "PREDICT" }>,
): Promise<void> {
  if (!exactModelProfile(command)) {
    post({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: command.correlation,
      error: errorDetail("invalid-request", "Magic model profile drift detected", false),
    });
    return;
  }
  if (active !== null) {
    post({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: command.correlation,
      error: errorDetail("invalid-request", "A Magic prediction is already active"),
    });
    return;
  }

  const request = { correlation: command.correlation, cancelled: false };
  active = request;
  post({
    protocol: MAGIC_WORKER_PROTOCOL_VERSION,
    type: "ACCEPTED",
    correlation: command.correlation,
  });
  let stage: MagicPredictionStage = "magic-model-loading";
  try {
    const runtime = await loadRuntime(command, request);
    assertCurrent(request);
    stage = "magic-encode";
    const current = await encodeSource(command, request, runtime);
    assertCurrent(request);
    stage = "magic-predict";
    progress(command, stage, null);
    const prompts = createMagicModelPrompts(command.strokes);
    if (prompts.length === 0) throw new Error("Magic prediction requires prompt points");
    const rawPoints: unknown = runtime.processor.reshape_input_points(
      [[prompts.map(({ point }) => [point.x, point.y])]],
      current.originalSizes,
      current.reshapedInputSizes,
    );
    const promptTensors = {
      input_points: rawPoints as Tensor,
      input_labels: new Tensor(
        "int64",
        new BigInt64Array(prompts.map(({ label }) => BigInt(label))),
        [1, 1, prompts.length],
      ),
      input_boxes: new Tensor("float32", new Float32Array(0), [1, 0, 4]),
    };
    let outputs: SamOutputs | null = null;
    let masks: Tensor[] = [];
    try {
      const rawPredictionOutputs: unknown = await runtime.model({
        pixel_values: current.pixelValues,
        image_embeddings: current.imageEmbeddings,
        image_positional_embeddings: current.imagePositionalEmbeddings,
        ...promptTensors,
      });
      const predictionOutputs = rawPredictionOutputs as SamOutputs;
      outputs = predictionOutputs;
      assertCurrent(request);
      masks = (await runtime.processor.post_process_masks(
        predictionOutputs.pred_masks,
        current.originalSizes,
        current.reshapedInputSizes,
        { binarize: true },
      )) as Tensor[];
      assertCurrent(request);
      const first = masks[0];
      if (first === undefined) throw new Error("SlimSAM returned no masks");
      const candidates = candidateBuffers(
        first,
        predictionOutputs.iou_scores,
        command.source.width,
        command.source.height,
      );
      post(
        {
          protocol: MAGIC_WORKER_PROTOCOL_VERSION,
          type: "SUCCEEDED",
          correlation: command.correlation,
          candidates,
        },
        candidates.map((candidate) => candidate.data),
      );
    } finally {
      Object.values(promptTensors).forEach((tensor) => tensor.dispose());
      outputs?.pred_masks.dispose();
      outputs?.iou_scores.dispose();
      masks.forEach((mask) => mask.dispose());
    }
  } catch (error) {
    if (error instanceof PredictionCancelled || request.cancelled) {
      post({
        protocol: MAGIC_WORKER_PROTOCOL_VERSION,
        type: "CANCELLED",
        correlation: command.correlation,
      });
    } else {
      let code: ProcessingErrorCode = "processing-failed";
      if (stage === "magic-model-loading") code = "model-load-failed";
      else if (stage === "magic-encode") code = "decode-failed";
      post({
        protocol: MAGIC_WORKER_PROTOCOL_VERSION,
        type: "FAILED",
        correlation: command.correlation,
        error: errorDetail(code, error),
      });
    }
  } finally {
    if (active === request) active = null;
  }
}

scope.addEventListener("message", (event) => {
  const command = event.data;
  if (command.protocol !== MAGIC_WORKER_PROTOCOL_VERSION) return;
  if (command.type === "CANCEL") {
    if (
      active !== null &&
      sameMagicCorrelation(active.correlation, command.correlation)
    ) {
      active.cancelled = true;
    }
    return;
  }
  if (command.type === "DISPOSE_RUNTIME") {
    if (active !== null) active.cancelled = true;
    const pending = activeTask ?? Promise.resolve();
    void pending
      .finally(() => disposeRuntime())
      .then(() => {
        post({ protocol: MAGIC_WORKER_PROTOCOL_VERSION, type: "DISPOSED" });
      });
    return;
  }
  activeTask = predict(command).finally(() => {
    activeTask = null;
  });
});
