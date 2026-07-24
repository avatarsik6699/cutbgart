import { describe, expect, it } from "vitest";

import { cleanupIsolatedSoftComponents } from "./edge-cleanup";

describe("cleanupIsolatedSoftComponents", () => {
  it("removes only isolated low-opacity components", () => {
    const result = cleanupIsolatedSoftComponents({
      matte: {
        width: 6,
        height: 1,
        data: new Uint8ClampedArray([24, 0, 255, 80, 80, 0]),
      },
      maxPixels: 1,
    });

    expect([...result.data]).toEqual([0, 0, 255, 80, 80, 0]);
  });

  it("preserves tiny opaque, translucent, and constrained targets", () => {
    const result = cleanupIsolatedSoftComponents({
      matte: {
        width: 5,
        height: 1,
        data: new Uint8ClampedArray([255, 0, 120, 0, 20]),
      },
      constraints: {
        width: 5,
        height: 1,
        data: new Int8Array([-1, -1, -1, -1, 1]),
      },
      maxPixels: 4,
    });

    expect([...result.data]).toEqual([255, 0, 120, 0, 255]);
  });

  it("is independently disableable and still applies hard constraints last", () => {
    const result = cleanupIsolatedSoftComponents({
      matte: { width: 2, height: 1, data: new Uint8ClampedArray([20, 200]) },
      constraints: { width: 2, height: 1, data: new Int8Array([-1, 0]) },
      enabled: false,
    });

    expect([...result.data]).toEqual([20, 0]);
  });

  it("rejects mismatched constraint dimensions", () => {
    expect(() =>
      cleanupIsolatedSoftComponents({
        matte: { width: 2, height: 1, data: new Uint8ClampedArray(2) },
        constraints: { width: 1, height: 1, data: new Int8Array(1) },
      }),
    ).toThrow(/constraint dimensions/);
  });
});
