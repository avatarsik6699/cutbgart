import { env } from "@/shared/config";
import { getProductionModel, type BrowserInferencePath } from "@/shared/lib";

export type LocalModelConfig = {
  cdnBaseUrl: string | undefined;
  dtype: "q8";
  inferencePath: BrowserInferencePath;
  modelId: "onnx-community/ISNet-ONNX";
  onnxRuntimeWebVersion: "1.27.0";
  revision: string;
};

export function createLocalModelConfig(
  inferencePath: BrowserInferencePath,
): LocalModelConfig {
  const profile = getProductionModel("fast");
  return Object.freeze({
    cdnBaseUrl: env.client.model.cdnBaseUrl,
    dtype: "q8",
    inferencePath,
    modelId: "onnx-community/ISNet-ONNX",
    onnxRuntimeWebVersion: env.client.model.onnxRuntimeWebVersion,
    revision: profile.revision,
  });
}
