import { describe, expect, it } from "vitest";

import { removeColourHalo } from "./colour-halo.policy";
import {
  buildRefinementTrimap,
  computeMattingInputSize,
  nextMattingAttempt,
} from "./fine-detail.policy";

describe("enhancement pixel policies", () => {
  it("bounds fine-detail inputs and freezes the fallback sequence", () => {
    expect(computeMattingInputSize({ width: 4096, height: 2048 })).toEqual({
      width: 1024,
      height: 512,
    });
    expect(nextMattingAttempt({ mode: "maximum", path: "webgpu" }, false)).toEqual({
      mode: "balanced",
      path: "webgpu",
    });
    expect(nextMattingAttempt({ mode: "balanced", path: "webgpu" }, true)).toEqual({
      mode: "balanced",
      path: "wasm",
    });
    expect(nextMattingAttempt({ mode: "balanced", path: "wasm" }, true)).toBeNull();
  });

  it("builds an unknown trimap around hard alpha boundaries", () => {
    const trimap = buildRefinementTrimap({
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([0, 255, 255]),
    });
    expect(trimap.unknownBounds).toEqual({ x: 0, y: 0, width: 3, height: 1 });
    expect(trimap.data).toEqual(new Uint8ClampedArray([128, 128, 128]));
  });

  it("cleans colour spill while leaving alpha authority to the matte", () => {
    const source = new Uint8ClampedArray([
      0, 0, 0, 255, 80, 180, 80, 255, 220, 20, 20, 255,
    ]);
    const matte = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([0, 128, 255]),
    };
    const result = removeColourHalo(source, matte);
    expect(result.changed).toBe(true);
    expect(result.actualPath).toBe("decontaminate");
    expect(result.matte.data).toEqual(matte.data);
    expect([result.rgba[3], result.rgba[7], result.rgba[11]]).toEqual([255, 255, 255]);
  });
});
