import { describe, expect, it } from "vitest";

import { groupModelCacheAssets } from "./model-cache-groups";

describe("groupModelCacheAssets", () => {
  it("groups only verified cached weights and runtime files into user-facing roles", () => {
    const groups = groupModelCacheAssets([
      {
        path: "onnx-community/ISNet-ONNX/resolve/rev/onnx/model_quantized.onnx",
        revision: "rev",
        byteSize: 44,
      },
      {
        path: "onnx-community/ISNet-ONNX/resolve/rev/config.json",
        revision: "rev",
        byteSize: 1,
      },
      {
        path: "onnx-community/BEN2-ONNX/resolve/rev/onnx/model_fp16.onnx",
        revision: "rev",
        byteSize: 219,
      },
      {
        path: "Xenova/slimsam-77-uniform/resolve/rev/onnx/vision_encoder_quantized.onnx",
        revision: "rev",
        byteSize: 9,
      },
      {
        path: "onnxruntime-web/1.27.0/ort-wasm-simd-threaded.wasm",
        revision: "npm:onnxruntime-web@1.27.0",
        byteSize: 13,
      },
    ]);

    expect(groups.models).toEqual([
      { id: "fast", assetCount: 1, byteSize: 44 },
      { id: "maximum", assetCount: 1, byteSize: 219 },
      { id: "magic", assetCount: 1, byteSize: 9 },
    ]);
    expect(groups.runtime).toEqual({
      assetCount: 1,
      byteSize: 13,
      version: "1.27.0",
    });
  });
});
