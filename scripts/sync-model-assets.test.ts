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

  it("rejects an incomplete ONNX Runtime asset set", () => {
    const incomplete = structuredClone(manifest);
    incomplete.onnxRuntimeWeb.files.pop();
    expect(() => validateManifest(incomplete, "1.27.0")).toThrow(
      /missing ONNX Runtime Web file/,
    );
  });
});
