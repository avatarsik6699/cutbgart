import { env } from "@/shared/config";
import {
  getProductionModel,
  type AutomaticModelMode,
  type BrowserInferencePath,
} from "@/shared/lib";

import { resolveUsableInferencePath } from "./browser-capabilities";

export type LocalModelConfig = {
  cdnBaseUrl: string | undefined;
  dtype: "q8" | "fp32" | "fp16";
  inferencePath: BrowserInferencePath;
  modelId: "onnx-community/ISNet-ONNX" | "onnx-community/BEN2-ONNX";
  mode?: AutomaticModelMode;
  onnxRuntimeWebVersion: "1.27.0";
  revision: string;
};

export function createLocalModelConfig(
  inferencePath: BrowserInferencePath,
  mode: AutomaticModelMode = "isnet-q8",
): LocalModelConfig {
  const requested = getProductionModel(mode);
  const profile =
    requested.requiresWebGPU && inferencePath !== "webgpu"
      ? getProductionModel("isnet-fp32")
      : requested;
  return Object.freeze({
    cdnBaseUrl: env.client.model.cdnBaseUrl,
    dtype: profile.dtype,
    inferencePath,
    mode: profile.id,
    modelId: profile.modelId,
    onnxRuntimeWebVersion: env.client.model.onnxRuntimeWebVersion,
    revision: profile.revision,
  });
}

export function selectLocalModelConfig(
  base: LocalModelConfig,
  mode: AutomaticModelMode,
): LocalModelConfig {
  const profile = getProductionModel(mode);
  const selected =
    profile.requiresWebGPU && base.inferencePath !== "webgpu"
      ? getProductionModel("isnet-fp32")
      : profile;
  return Object.freeze({
    ...base,
    dtype: selected.dtype,
    mode: selected.id,
    modelId: selected.modelId,
    revision: selected.revision,
  });
}

export async function resolveLocalModelConfig(
  requested: LocalModelConfig,
  resolvePath: typeof resolveUsableInferencePath = resolveUsableInferencePath,
): Promise<LocalModelConfig> {
  const inferencePath = await resolvePath(requested.inferencePath);
  return selectLocalModelConfig(
    { ...requested, inferencePath },
    requested.mode ?? "isnet-q8",
  );
}
