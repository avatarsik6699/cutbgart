import { describe, expect, it } from "vitest";

import {
  EVALUATION_MODELS,
  INTERACTIVE_EVALUATION_MODELS,
  formatModelSize,
  getEvaluationModel,
} from "./model-registry";

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

  it("pins eligible ViTMatte graphs and rejects unverified prompt artifacts", () => {
    const matting = INTERACTIVE_EVALUATION_MODELS.filter(
      ({ family }) => family === "matting",
    );
    expect(matting).toHaveLength(4);
    for (const model of matting) {
      expect(model.revision).toMatch(/^[a-f0-9]{40}$/);
      expect(model.graphFiles).toHaveLength(1);
      expect(model.license).toBe("Apache-2.0");
      expect(model.eligibility).toBe("production-eligible");
      expect(model.supportedPaths).toEqual(["webgpu", "wasm"]);
    }
    for (const id of ["efficient-sam-ti", "mobile-sam-vit-t"] as const) {
      const model = INTERACTIVE_EVALUATION_MODELS.find((item) => item.id === id)!;
      expect(model.eligibility).toBe("evidence-only");
      expect(model.graphFiles).toEqual([]);
      expect(model.supportedPaths).toEqual([]);
    }
  });
});
