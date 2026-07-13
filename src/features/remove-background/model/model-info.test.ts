import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DTYPES, MODEL_ID, MODEL_REVISION } from "./model-info";

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
});
