import { describe, expect, it } from "vitest";

import type { AlphaMatte, Trimap } from "../../../entities/processed-image";
import {
  computeMattingInputSize,
  computeRefinementCrop,
  cropAlphaMatte,
  restoreRefinedCrop,
} from "./focus-crop";

describe("focus crop", () => {
  it("bounds and pads only the unknown region", () => {
    const trimap: Trimap = {
      width: 100,
      height: 80,
      data: new Uint8ClampedArray(8_000),
      unknownBounds: { x: 2, y: 3, width: 10, height: 8 },
    };
    expect(computeRefinementCrop(trimap, 5)).toEqual({
      x: 0,
      y: 0,
      width: 17,
      height: 16,
    });
    expect(computeRefinementCrop({ ...trimap, unknownBounds: null })).toBeNull();
  });

  it("bounds large model inputs while preserving their aspect ratio", () => {
    expect(computeMattingInputSize({ width: 2086, height: 2253 })).toEqual({
      width: 948,
      height: 1024,
    });
    expect(computeMattingInputSize({ width: 400, height: 400 })).toEqual({
      width: 400,
      height: 400,
    });
    expect(computeMattingInputSize({ width: 4096, height: 512 })).toEqual({
      width: 1024,
      height: 128,
    });
    expect(() => computeMattingInputSize({ width: 0, height: 1 })).toThrow(
      /must be positive/,
    );
  });

  it("restores soft alpha only inside unknown pixels and preserves outside bytes", () => {
    const prior: AlphaMatte = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([7, 8, 9, 10, 11, 12, 13, 14]),
    };
    const trimap: Trimap = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([0, 128, 128, 255, 0, 128, 128, 255]),
      unknownBounds: { x: 1, y: 0, width: 2, height: 2 },
    };
    const predicted: AlphaMatte = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([64, 128, 192, 224]),
    };
    const result = restoreRefinedCrop({
      predicted,
      prior,
      trimap,
      crop: { x: 1, y: 0, width: 2, height: 2 },
    });
    expect([...result.data]).toEqual([7, 64, 128, 10, 11, 192, 224, 14]);
    expect(cropAlphaMatte(prior, { x: 1, y: 0, width: 2, height: 2 }).data).toEqual(
      new Uint8ClampedArray([8, 9, 12, 13]),
    );
  });
});
