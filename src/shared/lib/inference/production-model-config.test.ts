import { describe, expect, it } from "vitest";

import {
  getProductionModel,
  normalizeModelMode,
  PRODUCTION_MODELS,
  GUIDED_MODEL,
  MATTING_MODELS,
  getMattingModel,
} from "./production-model-config";

describe("production model config", () => {
  it("keeps legacy quality aliases on immutable pinned profiles", () => {
    expect(normalizeModelMode("fast")).toBe("isnet-q8");
    expect(normalizeModelMode("max")).toBe("isnet-fp32");
    expect(getProductionModel("fast")).toMatchObject({
      modelId: "onnx-community/ISNet-ONNX",
      revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
      dtype: "q8",
    });
    expect(PRODUCTION_MODELS).toHaveLength(3);
    expect(GUIDED_MODEL).toEqual({
      modelId: "Xenova/slimsam-77-uniform",
      revision: "7c8459c48dabad6291b384c97be46c451c25d6c4",
      dtype: "q8",
      approximateBytes: 13_840_000,
      supportedPaths: ["wasm"],
      license: "Apache-2.0",
    });
  });

  it("keeps Enhancement matting profiles immutable and revision-pinned", () => {
    expect(MATTING_MODELS).toEqual([
      expect.objectContaining({
        id: "vitmatte-small-distinctions646-q8",
        mode: "balanced",
        modelId: "Xenova/vitmatte-small-distinctions-646",
        revision: "358d428c452e5e0cd52955011a8b51944731d28e",
        graphFile: "onnx/model_quantized.onnx",
        dtype: "q8",
      }),
      expect.objectContaining({
        id: "vitmatte-small-distinctions646-fp32",
        mode: "maximum",
        modelId: "Xenova/vitmatte-small-distinctions-646",
        revision: "358d428c452e5e0cd52955011a8b51944731d28e",
        graphFile: "onnx/model.onnx",
        dtype: "fp32",
      }),
    ]);
    expect(getMattingModel("balanced")).toBe(MATTING_MODELS[0]);
    expect(Object.isFrozen(MATTING_MODELS)).toBe(true);
    expect(MATTING_MODELS.every(Object.isFrozen)).toBe(true);
  });
});
