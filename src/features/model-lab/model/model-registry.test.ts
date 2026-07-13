import { describe, expect, it } from "vitest";

import { EVALUATION_MODELS, formatModelSize, getEvaluationModel } from "./model-registry";

describe("model-lab registry", () => {
  it("pins four unique model variants to immutable revisions", () => {
    expect(EVALUATION_MODELS.map(({ id }) => id)).toEqual([
      "isnet-q8",
      "isnet-fp32",
      "ben2-fp16",
      "mvanet-q4",
    ]);
    expect(new Set(EVALUATION_MODELS.map(({ id }) => id)).size).toBe(4);
    for (const model of EVALUATION_MODELS) {
      expect(model.revision).toMatch(/^[a-f0-9]{40}$/);
      expect(model.approximateBytes).toBeGreaterThan(40_000_000);
      expect(model.supportedPaths).toEqual(["webgpu", "wasm"]);
    }
  });

  it("resolves profiles and formats decimal download sizes", () => {
    expect(getEvaluationModel("ben2-fp16").license).toBe("MIT");
    expect(formatModelSize(219_121_675)).toBe("219 МБ");
  });
});
