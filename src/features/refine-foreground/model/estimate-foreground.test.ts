import { describe, expect, it } from "vitest";

import { estimateForegroundPixels } from "./estimate-foreground";

function pixels(...values: readonly [number, number, number, number][]) {
  return new Uint8ClampedArray(values.flat());
}

describe("estimateForegroundPixels", () => {
  it("decontaminates only soft pixels and returns a bounded dirty patch", () => {
    const source = pixels([20, 40, 60, 17], [140, 150, 160, 33], [240, 230, 220, 49]);
    const result = estimateForegroundPixels({
      rgba: source,
      matte: { width: 3, height: 1, data: new Uint8ClampedArray([255, 128, 0]) },
      componentCleanup: false,
    });

    expect(result.actualPath).toBe("decontaminate");
    expect(result.fallback).toBe("none");
    expect([...result.rgba.slice(0, 4)]).toEqual([...source.slice(0, 4)]);
    expect([...result.rgba.slice(8, 12)]).toEqual([...source.slice(8, 12)]);
    expect(result.rgba[4]).not.toBe(source[4]);
    expect([result.rgba[3], result.rgba[7], result.rgba[11]]).toEqual([17, 33, 49]);
    expect(result.dirtyPatch?.bounds).toEqual({ x: 1, y: 0, width: 1, height: 1 });
    expect(result.dirtyPatch?.rgba).toEqual(result.rgba.slice(4, 8));
  });

  it("keeps constrained pixels byte-for-byte and applies the constraint to matte", () => {
    const source = pixels([10, 20, 30, 4], [100, 120, 140, 5], [240, 240, 240, 6]);
    const result = estimateForegroundPixels({
      rgba: source,
      matte: { width: 3, height: 1, data: new Uint8ClampedArray([255, 128, 0]) },
      constraints: { width: 3, height: 1, data: new Int8Array([-1, 1, -1]) },
      componentCleanup: false,
    });

    expect([...result.rgba]).toEqual([...source]);
    expect([...result.matte.data]).toEqual([255, 255, 0]);
    expect(result.actualPath).toBe("unchanged");
    expect(result.fallback).toBe("no-soft-edge");
  });

  it("uses the bounded foreground fallback when no background sample exists", () => {
    const source = pixels([10, 30, 50, 255], [90, 100, 110, 255]);
    const result = estimateForegroundPixels({
      rgba: source,
      matte: { width: 2, height: 1, data: new Uint8ClampedArray([255, 128]) },
      componentCleanup: false,
    });

    expect(result.actualPath).toBe("edge-aware-fallback");
    expect(result.fallback).toBe("no-background-samples");
    expect(result.rgba[4]).toBeLessThan(90);
    expect(result.rgba[7]).toBe(255);
  });

  it("returns an unchanged classified fallback when no safe samples exist", () => {
    const source = pixels([40, 50, 60, 13]);
    const result = estimateForegroundPixels({
      rgba: source,
      matte: { width: 1, height: 1, data: new Uint8ClampedArray([128]) },
      componentCleanup: false,
    });

    expect(result.actualPath).toBe("unchanged");
    expect(result.fallback).toBe("no-background-samples");
    expect(result.dirtyPatch).toBeNull();
    expect([...result.rgba]).toEqual([...source]);
  });

  it("rejects a source buffer whose dimensions do not match the matte", () => {
    expect(() =>
      estimateForegroundPixels({
        rgba: new Uint8ClampedArray(4),
        matte: { width: 2, height: 1, data: new Uint8ClampedArray(2) },
      }),
    ).toThrow(/dimensions must match/);
  });
});
