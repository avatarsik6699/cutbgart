import { describe, expect, it } from "vitest";

import {
  getProductionModel,
  normalizeModelMode,
  PRODUCTION_MODELS,
  GUIDED_MODEL,
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
});
