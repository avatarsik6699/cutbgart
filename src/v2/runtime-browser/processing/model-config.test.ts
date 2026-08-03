import { describe, expect, it } from "vitest";

import { createLocalModelConfig } from "./model-config";

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
});
