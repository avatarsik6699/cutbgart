import { describe, expect, it } from "vitest";

import {
  buildModelAssetPlan,
  buildOnnxRuntimeAssetPlan,
  validateManifest,
  type ModelManifest,
} from "./sync-model-assets";

const manifest: ModelManifest = {
  models: [
    {
      id: "onnx-community/ISNet-ONNX",
      revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
      files: [
        "config.json",
        "preprocessor_config.json",
        "onnx/model_quantized.onnx",
        "onnx/model.onnx",
      ],
    },
    {
      id: "onnx-community/BEN2-ONNX",
      revision: "c552aa82688edce09f0ac9d2e31ad53d9d629010",
      files: ["config.json", "preprocessor_config.json", "onnx/model_fp16.onnx"],
    },
    {
      id: "Xenova/slimsam-77-uniform",
      revision: "7c8459c48dabad6291b384c97be46c451c25d6c4",
      files: [
        "config.json",
        "preprocessor_config.json",
        "onnx/vision_encoder_quantized.onnx",
        "onnx/prompt_encoder_mask_decoder_quantized.onnx",
      ],
    },
    {
      id: "Xenova/vitmatte-small-distinctions-646",
      revision: "358d428c452e5e0cd52955011a8b51944731d28e",
      files: [
        "config.json",
        "preprocessor_config.json",
        "onnx/model_quantized.onnx",
        "onnx/model.onnx",
      ],
    },
  ],
  onnxRuntimeWeb: {
    version: "1.27.0",
    files: [
      "ort-wasm-simd-threaded.asyncify.mjs",
      "ort-wasm-simd-threaded.asyncify.wasm",
      "ort-wasm-simd-threaded.jsep.mjs",
      "ort-wasm-simd-threaded.jsep.wasm",
      "ort-wasm-simd-threaded.jspi.mjs",
      "ort-wasm-simd-threaded.jspi.wasm",
      "ort-wasm-simd-threaded.mjs",
      "ort-wasm-simd-threaded.wasm",
    ],
  },
};

describe("model asset manifest", () => {
  it("maps the pinned Hugging Face revision to the Nginx asset layout", () => {
    validateManifest(manifest, "1.27.0");
    expect(buildModelAssetPlan(manifest)).toContainEqual({
      source:
        "https://huggingface.co/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/onnx/model_quantized.onnx",
      relativePath:
        "onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/onnx/model_quantized.onnx",
    });
  });

  it("rejects an ONNX Runtime version mismatch", () => {
    expect(() => validateManifest(manifest, "1.28.0")).toThrow(/does not match/);
  });

  it("maps pinned ONNX Runtime variants to the CDN asset layout", () => {
    expect(buildOnnxRuntimeAssetPlan(manifest)).toContainEqual({
      source:
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort-wasm-simd-threaded.asyncify.mjs",
      relativePath: "onnxruntime-web/1.27.0/ort-wasm-simd-threaded.asyncify.mjs",
    });
  });

  it("maps BEN2 and SlimSAM immutable assets without bundling binaries", () => {
    const plan = buildModelAssetPlan(manifest);
    expect(
      plan.some((asset) =>
        asset.relativePath.includes(
          "BEN2-ONNX/resolve/c552aa82688edce09f0ac9d2e31ad53d9d629010/onnx/model_fp16.onnx",
        ),
      ),
    ).toBe(true);
    expect(
      plan.some((asset) =>
        asset.relativePath.includes(
          "slimsam-77-uniform/resolve/7c8459c48dabad6291b384c97be46c451c25d6c4/onnx/vision_encoder_quantized.onnx",
        ),
      ),
    ).toBe(true);
    expect(
      plan.some((asset) =>
        asset.relativePath.includes(
          "vitmatte-small-distinctions-646/resolve/358d428c452e5e0cd52955011a8b51944731d28e/onnx/model.onnx",
        ),
      ),
    ).toBe(true);
  });

  it("rejects an incomplete ONNX Runtime asset set", () => {
    const incomplete = structuredClone(manifest);
    incomplete.onnxRuntimeWeb.files.pop();
    expect(() => validateManifest(incomplete, "1.27.0")).toThrow(
      /missing ONNX Runtime Web file/,
    );
  });
});
