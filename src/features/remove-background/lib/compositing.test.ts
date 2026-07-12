import { describe, expect, it } from "vitest";

import type { AlphaMatte } from "../../../entities/processed-image";
import { applyAlphaMatte, getCoverRect } from "./compositing";

function makeMatte(alphaValues: number[]): AlphaMatte {
  return {
    width: alphaValues.length,
    height: 1,
    data: new Uint8ClampedArray(alphaValues),
  };
}

describe("applyAlphaMatte", () => {
  it("overwrites only the alpha channel, leaving RGB untouched", () => {
    // Two opaque red pixels.
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]);
    const matte = makeMatte([128, 0]);

    const result = applyAlphaMatte(rgba, matte);

    expect(Array.from(result)).toEqual([255, 0, 0, 128, 255, 0, 0, 0]);
  });

  it("does not mutate the input buffer", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255]);
    const matte = makeMatte([0]);

    applyAlphaMatte(rgba, matte);

    expect(rgba[3]).toBe(255);
  });

  it("throws when the pixel buffer size doesn't match the matte dimensions", () => {
    const rgba = new Uint8ClampedArray(4);
    const matte = makeMatte([10, 20]);

    expect(() => applyAlphaMatte(rgba, matte)).toThrow(/does not match matte dimensions/);
  });
});

describe("getCoverRect", () => {
  it("centers and crops a wide background without stretching", () => {
    expect(
      getCoverRect({ width: 400, height: 200 }, { width: 100, height: 100 }),
    ).toEqual({
      x: -50,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  it("centers and crops a tall background without bars", () => {
    expect(
      getCoverRect({ width: 100, height: 200 }, { width: 100, height: 100 }),
    ).toEqual({
      x: 0,
      y: -50,
      width: 100,
      height: 200,
    });
  });
});
