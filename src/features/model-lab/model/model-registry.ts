import type {
  EvaluationModelId,
  EvaluationModelProfile,
  InteractiveEvaluationModelId,
  InteractiveEvaluationModelProfile,
} from "./types";

const ALL_BROWSER_PATHS = ["webgpu", "wasm"] as const;

export const EVALUATION_MODELS = [
  {
    id: "isnet-q8",
    label: "IS-Net q8",
    modelId: "onnx-community/ISNet-ONNX",
    revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
    dtype: "q8",
    approximateBytes: 44_348_381,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "AGPL-3.0",
    resourceWarning: "Быстрый действующий baseline, около 44 МБ.",
  },
  {
    id: "isnet-fp32",
    label: "IS-Net fp32",
    modelId: "onnx-community/ISNet-ONNX",
    revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
    dtype: "fp32",
    approximateBytes: 176_114_856,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "AGPL-3.0",
    resourceWarning: "Полноточный действующий baseline, около 176 МБ.",
  },
  {
    id: "ben2-fp16",
    label: "BEN2 fp16",
    modelId: "onnx-community/BEN2-ONNX",
    revision: "c552aa82688edce09f0ac9d2e31ad53d9d629010",
    dtype: "fp16",
    approximateBytes: 219_121_675,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "MIT",
    resourceWarning: "Тяжёлый кандидат, около 219 МБ; возможен высокий расход памяти.",
  },
  {
    id: "mvanet-q4",
    label: "MVANet q4",
    modelId: "onnx-community/MVANet-ONNX",
    revision: "43ec3427514b8d9164eea02df93ca2f1b036bb7b",
    dtype: "q4",
    approximateBytes: 125_289_734,
    supportedPaths: ALL_BROWSER_PATHS,
    license: "MIT",
    resourceWarning: "Квантованный тяжёлый кандидат, около 125 МБ.",
  },
] as const satisfies readonly EvaluationModelProfile[];

export const INTERACTIVE_EVALUATION_MODELS = [
  {
    id: "vitmatte-small-composition1k-q8",
    label: "ViTMatte-small Composition-1k q8",
    family: "matting",
    modelId: "Xenova/vitmatte-small-composition-1k",
    revision: "6bc1297f6140f055a227b6d2cfe8c093281f35d2",
    graphFiles: ["onnx/model_quantized.onnx"],
    dtype: "q8",
    license: "Apache-2.0",
    eligibility: "production-eligible",
    supportedPaths: ALL_BROWSER_PATHS,
    approximateBytes: 27_499_369,
    resourceWarning: "Квантованный alpha-refiner, около 27,5 МБ.",
  },
  {
    id: "vitmatte-small-composition1k-fp32",
    label: "ViTMatte-small Composition-1k fp32",
    family: "matting",
    modelId: "Xenova/vitmatte-small-composition-1k",
    revision: "6bc1297f6140f055a227b6d2cfe8c093281f35d2",
    graphFiles: ["onnx/model.onnx"],
    dtype: "fp32",
    license: "Apache-2.0",
    eligibility: "production-eligible",
    supportedPaths: ALL_BROWSER_PATHS,
    approximateBytes: 103_885_865,
    resourceWarning: "Полноточный alpha-refiner, около 104 МБ.",
  },
  {
    id: "vitmatte-small-distinctions646-q8",
    label: "ViTMatte-small Distinctions-646 q8",
    family: "matting",
    modelId: "Xenova/vitmatte-small-distinctions-646",
    revision: "358d428c452e5e0cd52955011a8b51944731d28e",
    graphFiles: ["onnx/model_quantized.onnx"],
    dtype: "q8",
    license: "Apache-2.0",
    eligibility: "production-eligible",
    supportedPaths: ALL_BROWSER_PATHS,
    approximateBytes: 27_499_369,
    resourceWarning: "Квантованный alpha-refiner, около 27,5 МБ.",
  },
  {
    id: "vitmatte-small-distinctions646-fp32",
    label: "ViTMatte-small Distinctions-646 fp32",
    family: "matting",
    modelId: "Xenova/vitmatte-small-distinctions-646",
    revision: "358d428c452e5e0cd52955011a8b51944731d28e",
    graphFiles: ["onnx/model.onnx"],
    dtype: "fp32",
    license: "Apache-2.0",
    eligibility: "production-eligible",
    supportedPaths: ALL_BROWSER_PATHS,
    approximateBytes: 103_885_865,
    resourceWarning: "Полноточный alpha-refiner, около 104 МБ.",
  },
  {
    id: "efficient-sam-ti",
    label: "EfficientSAM-Ti",
    family: "promptable",
    modelId: "github:yformer/EfficientSAM",
    revision: "d525f622e6f640acf5a0fc37c7ca1f243da5bde0",
    graphFiles: [],
    dtype: "fp32",
    license: "Apache-2.0",
    eligibility: "evidence-only",
    supportedPaths: [],
    approximateBytes: 0,
    resourceWarning: "Нет проверенного first-party browser-ready ONNX-дистрибутива.",
    unsupportedReason:
      "Официальный репозиторий содержит export-код, но не публикует immutable ONNX-веса.",
  },
  {
    id: "mobile-sam-vit-t",
    label: "MobileSAM ViT-T",
    family: "promptable",
    modelId: "github:ChaoningZhang/MobileSAM",
    revision: "f706ad9c4eb7f219c00d9050e46328518ffb65d2",
    graphFiles: [],
    dtype: "fp32",
    license: "Apache-2.0",
    eligibility: "evidence-only",
    supportedPaths: [],
    approximateBytes: 0,
    resourceWarning: "Нет проверенного first-party browser-ready ONNX-дистрибутива.",
    unsupportedReason:
      "Официальный репозиторий содержит export-код, но не публикует immutable ONNX-веса.",
  },
  {
    id: "slimsam-q8",
    label: "SlimSAM q8 (production baseline)",
    family: "promptable",
    modelId: "Xenova/slimsam-77-uniform",
    revision: "7c8459c48dabad6291b384c97be46c451c25d6c4",
    graphFiles: [
      "onnx/vision_encoder_quantized.onnx",
      "onnx/prompt_encoder_mask_decoder_quantized.onnx",
    ],
    dtype: "q8",
    license: "Apache-2.0",
    eligibility: "production-eligible",
    supportedPaths: ["wasm"],
    approximateBytes: 13_840_000,
    resourceWarning: "Действующий promptable baseline; оценивается как контроль.",
    unsupportedReason:
      "Phase 18 не дублирует production SlimSAM worker; runtime evidence уже зафиксирован Phase 17.",
  },
] as const satisfies readonly InteractiveEvaluationModelProfile[];

const MODEL_BY_ID = new Map<EvaluationModelId, EvaluationModelProfile>(
  EVALUATION_MODELS.map((model) => [model.id, model]),
);

const INTERACTIVE_MODEL_BY_ID = new Map<
  InteractiveEvaluationModelId,
  InteractiveEvaluationModelProfile
>(INTERACTIVE_EVALUATION_MODELS.map((model) => [model.id, model]));

export function getEvaluationModel(id: EvaluationModelId): EvaluationModelProfile {
  const model = MODEL_BY_ID.get(id);
  if (!model) throw new Error(`Unknown evaluation model: ${id}`);
  return model;
}

export function getInteractiveEvaluationModel(
  id: InteractiveEvaluationModelId,
): InteractiveEvaluationModelProfile {
  const model = INTERACTIVE_MODEL_BY_ID.get(id);
  if (!model) throw new Error(`Unknown interactive evaluation model: ${id}`);
  return model;
}

export function formatModelSize(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} МБ`;
}
