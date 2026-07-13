import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DTYPES,
  MODEL_ID,
  MODEL_REVISION,
  PRODUCTION_MODELS,
  getProductionModel,
} from "./model-info";

describe("model info", () => {
  it("stays synchronized with the deployment manifest", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), "models.manifest.json"), "utf8"),
    ) as {
      models: Array<{ id: string; revision: string; files: string[] }>;
    };
    const [model] = manifest.models;

    expect(model).toMatchObject({ id: MODEL_ID, revision: MODEL_REVISION });
    expect(model?.files).toEqual(
      expect.arrayContaining([
        DTYPES.fast === "q8" ? "onnx/model_quantized.onnx" : "",
        DTYPES.max === "fp32" ? "onnx/model.onnx" : "",
      ]),
    );
  });

  it("registers all production modes with BEN2 restricted to WebGPU", () => {
    expect(PRODUCTION_MODELS.map((profile) => profile.id)).toEqual([
      "isnet-q8",
      "isnet-fp32",
      "ben2-fp16",
    ]);
    expect(getProductionModel("fast").id).toBe("isnet-q8");
    expect(getProductionModel("max").id).toBe("isnet-fp32");
    expect(getProductionModel("ben2-fp16")).toMatchObject({
      dtype: "fp16",
      supportedPaths: ["webgpu"],
      requiresWebGPU: true,
    });
  });
});
