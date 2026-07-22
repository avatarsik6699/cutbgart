import { describe, expect, it } from "vitest";

import { nextMattingAttempt } from "./runtime-policy";

describe("matting runtime policy", () => {
  it("retries Balanced WebGPU execution failures on WASM exactly once", () => {
    expect(nextMattingAttempt({ mode: "balanced", path: "webgpu" }, true)).toEqual({
      mode: "balanced",
      path: "wasm",
    });
    expect(nextMattingAttempt({ mode: "balanced", path: "wasm" }, true)).toBeNull();
    expect(nextMattingAttempt({ mode: "balanced", path: "webgpu" }, false)).toBeNull();
  });

  it("keeps Maximum bounded to fp32 then q8 and selects WASM for WebGPU failures", () => {
    expect(nextMattingAttempt({ mode: "maximum", path: "webgpu" }, true)).toEqual({
      mode: "balanced",
      path: "wasm",
    });
    expect(nextMattingAttempt({ mode: "maximum", path: "webgpu" }, false)).toEqual({
      mode: "balanced",
      path: "webgpu",
    });
    expect(nextMattingAttempt({ mode: "maximum", path: "wasm" }, true)).toEqual({
      mode: "balanced",
      path: "wasm",
    });
  });
});
