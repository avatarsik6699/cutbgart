import { describe, expect, it } from "vitest";

import { createLocalModelConfig, resolveLocalModelConfig } from "./model-config";

describe("createLocalModelConfig", () => {
  it("uses the immutable fast production profile for the selected browser path", () => {
    expect(createLocalModelConfig("webgpu")).toMatchObject({
      dtype: "q8",
      inferencePath: "webgpu",
      modelId: "onnx-community/ISNet-ONNX",
      onnxRuntimeWebVersion: "1.27.0",
      revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
    });
  });

  it("selects every explicit automatic model and falls BEN2 back on WASM", () => {
    expect(createLocalModelConfig("webgpu", "isnet-fp32")).toMatchObject({
      mode: "isnet-fp32",
      dtype: "fp32",
      modelId: "onnx-community/ISNet-ONNX",
    });
    expect(createLocalModelConfig("webgpu", "ben2-fp16")).toMatchObject({
      mode: "ben2-fp16",
      dtype: "fp16",
      modelId: "onnx-community/BEN2-ONNX",
    });
    expect(createLocalModelConfig("wasm", "ben2-fp16")).toMatchObject({
      mode: "isnet-fp32",
      dtype: "fp32",
      inferencePath: "wasm",
    });
  });

  it("reselects ISNet fp32 when an initially advertised WebGPU path is unusable", async () => {
    const requested = createLocalModelConfig("webgpu", "ben2-fp16");

    await expect(
      resolveLocalModelConfig(requested, () => Promise.resolve("wasm")),
    ).resolves.toMatchObject({
      dtype: "fp32",
      inferencePath: "wasm",
      mode: "isnet-fp32",
      modelId: "onnx-community/ISNet-ONNX",
    });
  });
});
