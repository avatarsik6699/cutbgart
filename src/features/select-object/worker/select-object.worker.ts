import {
  AutoProcessor,
  env,
  RawImage,
  SamModel,
  Tensor,
  type SamProcessor,
} from "@huggingface/transformers";

import type { SourceImage } from "../../../entities/processed-image";
import { env as appEnv } from "../../../shared/config";
import {
  maskCandidates,
  normalizedBoxToPixels,
  normalizedPointToPixels,
} from "../model/prompt-coordinates";
import {
  GUIDED_MODEL,
  type SelectObjectWorkerRequest,
  type SelectObjectWorkerResponse,
  type IterativeSelectionPrompt,
} from "../model/types";

interface WorkerScope {
  postMessage(message: SelectObjectWorkerResponse, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<SelectObjectWorkerRequest>) => void,
  ): void;
}

const scope = globalThis as unknown as WorkerScope;
const upstreamRemoteHost = env.remoteHost;
const upstreamWasmPaths = env.backends.onnx.wasm?.wasmPaths;
env.useWasmCache = true;
env.remotePathTemplate = `{model}/resolve/${GUIDED_MODEL.revision}/`;
if (appEnv.modelCdnBaseUrl) {
  env.remoteHost = `${appEnv.modelCdnBaseUrl}/`;
  env.backends.onnx.wasm!.wasmPaths = `${appEnv.modelCdnBaseUrl}/onnxruntime-web/${appEnv.onnxRuntimeWebVersion}/`;
}

type Processor = SamProcessor;
type Model = SamModel;
interface Encoding {
  source: SourceImage;
  pixelValues: Tensor;
  originalSizes: [number, number][];
  reshapedInputSizes: [number, number][];
  imageEmbeddings: Tensor;
  imagePositionalEmbeddings: Tensor;
}

interface SamInputs {
  pixel_values: Tensor;
  original_sizes: [number, number][];
  reshaped_input_sizes: [number, number][];
}

interface SamOutputs {
  pred_masks: Tensor;
  iou_scores: Tensor;
}

let model: Model | null = null;
let processor: Processor | null = null;
let encoding: Encoding | null = null;

function post(message: SelectObjectWorkerResponse): void {
  scope.postMessage(message);
}

function disposeEncoding(): void {
  encoding?.pixelValues.dispose();
  encoding?.imageEmbeddings.dispose();
  encoding?.imagePositionalEmbeddings.dispose();
  encoding = null;
}

async function disposeAll(): Promise<void> {
  disposeEncoding();
  await model?.dispose();
  model = null;
  processor = null;
}

async function load(revision: number): Promise<{ model: Model; processor: Processor }> {
  if (model && processor) return { model, processor };
  post({ type: "status", revision, status: "loading-model", progress: 0 });
  const options = {
    revision: GUIDED_MODEL.revision,
    dtype: GUIDED_MODEL.dtype,
    device: "wasm" as const,
    progress_callback: (info: { status: string; progress?: number }) => {
      if (info.status === "progress_total")
        post({
          type: "status",
          revision,
          status: "loading-model",
          progress: info.progress ?? 0,
        });
    },
  };
  try {
    [model, processor] = (await Promise.all([
      SamModel.from_pretrained(GUIDED_MODEL.modelId, options),
      AutoProcessor.from_pretrained(GUIDED_MODEL.modelId, {
        revision: GUIDED_MODEL.revision,
      }),
    ])) as [Model, Processor];
  } catch (cdnError) {
    env.remoteHost = upstreamRemoteHost;
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = upstreamWasmPaths;
    [model, processor] = (await Promise.all([
      SamModel.from_pretrained(GUIDED_MODEL.modelId, options),
      AutoProcessor.from_pretrained(GUIDED_MODEL.modelId, {
        revision: GUIDED_MODEL.revision,
      }),
    ]).catch((error) => {
      throw new Error(`${String(error)} (CDN attempt: ${String(cdnError)})`);
    })) as [Model, Processor];
  }
  return { model, processor };
}

async function encode(source: SourceImage, revision: number): Promise<void> {
  disposeEncoding();
  const loaded = await load(revision);
  post({ type: "status", revision, status: "encoding-image" });
  const image = await RawImage.read(source.blob);
  const rawInputs: unknown = await loaded.processor(image);
  const inputs = rawInputs as SamInputs;
  const embeddings = await loaded.model.get_image_embeddings({
    pixel_values: inputs.pixel_values,
  });
  encoding = {
    source,
    pixelValues: inputs.pixel_values,
    originalSizes: inputs.original_sizes,
    reshapedInputSizes: inputs.reshaped_input_sizes,
    imageEmbeddings: embeddings.image_embeddings,
    imagePositionalEmbeddings: embeddings.image_positional_embeddings,
  };
  post({ type: "status", revision, status: "ready-for-prompt" });
}

function promptInputs(
  prompt: IterativeSelectionPrompt,
  loaded: Processor,
  current: Encoding,
): Record<string, Tensor> {
  const points = prompt.points.map((point) =>
    normalizedPointToPixels(point, current.source.width, current.source.height),
  );
  const tensors: Record<string, Tensor> = {};
  if (points.length) {
    const rawInputPoints: unknown = loaded.reshape_input_points(
      [[points.map((point) => [point.x, point.y])]],
      current.originalSizes,
      current.reshapedInputSizes,
    );
    tensors.input_points = rawInputPoints as Tensor;
    tensors.input_labels = new Tensor(
      "int64",
      new BigInt64Array(points.map((point) => BigInt(point.label))),
      [1, 1, points.length],
    );
  } else {
    tensors.input_points = new Tensor("float32", new Float32Array([0, 0]), [1, 1, 1, 2]);
    tensors.input_labels = new Tensor("int64", new BigInt64Array([-10n]), [1, 1, 1]);
  }
  if (prompt.box) {
    const box = normalizedBoxToPixels(
      prompt.box,
      current.source.width,
      current.source.height,
    );
    const rawInputBoxes: unknown = loaded.reshape_input_points(
      [[[box.xMin, box.yMin, box.xMax, box.yMax]]],
      current.originalSizes,
      current.reshapedInputSizes,
      true,
    );
    tensors.input_boxes = rawInputBoxes as Tensor;
  } else tensors.input_boxes = new Tensor("float32", new Float32Array(0), [1, 0, 4]);
  // The pinned SlimSAM decoder does not declare mask_inputs/has_mask_input.
  // `previousMask` remains in the protocol for compatible future graphs; local
  // progressive continuity is provided by guided fusion rather than a hidden
  // model-specific assumption here.
  return tensors;
}

async function predict(prompt: IterativeSelectionPrompt): Promise<void> {
  if (!encoding || !model || !processor)
    throw new Error("Encode an image before prompting");
  post({ type: "status", revision: prompt.revision, status: "predicting-mask" });
  const promptTensors = promptInputs(prompt, processor, encoding);
  try {
    const rawOutputs: unknown = await model({
      pixel_values: encoding.pixelValues,
      image_embeddings: encoding.imageEmbeddings,
      image_positional_embeddings: encoding.imagePositionalEmbeddings,
      ...promptTensors,
    });
    const outputs = rawOutputs as SamOutputs;
    const rawMasks: unknown = await processor.post_process_masks(
      outputs.pred_masks,
      encoding.originalSizes,
      encoding.reshapedInputSizes,
      { binarize: true },
    );
    const masks = rawMasks as Tensor[];
    const first = masks[0];
    if (!first) throw new Error("SlimSAM returned no masks");
    const candidates = maskCandidates(
      first.data as unknown as ArrayLike<number>,
      outputs.iou_scores.data as unknown as ArrayLike<number>,
      encoding.source.width,
      encoding.source.height,
      prompt.revision,
    );
    outputs.pred_masks.dispose();
    outputs.iou_scores.dispose();
    first.dispose();
    post({ type: "candidates", revision: prompt.revision, candidates });
  } finally {
    Object.values(promptTensors).forEach((tensor) => tensor.dispose());
  }
}

scope.addEventListener("message", (event) => {
  const request = event.data;
  if (request.type === "reset") {
    void disposeAll().then(() =>
      post({ type: "status", revision: request.revision, status: "idle" }),
    );
    return;
  }
  void (
    request.type === "encode"
      ? encode(request.source, request.revision)
      : predict(request.prompt)
  ).catch((error: unknown) => {
    post({
      type: "error",
      revision: request.type === "encode" ? request.revision : request.prompt.revision,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});
