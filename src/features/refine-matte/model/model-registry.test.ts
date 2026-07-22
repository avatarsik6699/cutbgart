import { describe, expect, it } from "vitest";

import { MATTING_MODELS, getMattingModel, recommendMattingMode } from "./model-registry";

describe("production matting registry", () => {
  it("pins exactly the selected Distinctions-646 alternatives", () => {
    expect(MATTING_MODELS).toHaveLength(2);
    expect(MATTING_MODELS.map((profile) => profile.graphFile)).toEqual([
      "onnx/model_quantized.onnx",
      "onnx/model.onnx",
    ]);
    expect(new Set(MATTING_MODELS.map((profile) => profile.revision))).toEqual(
      new Set(["358d428c452e5e0cd52955011a8b51944731d28e"]),
    );
    expect(getMattingModel("maximum").dtype).toBe("fp32");
  });

  it("recommends maximum only for confirmed WebGPU", () => {
    expect(recommendMattingMode("webgpu")).toBe("maximum");
    expect(recommendMattingMode("wasm")).toBe("balanced");
    expect(recommendMattingMode(null)).toBe("balanced");
  });
});
