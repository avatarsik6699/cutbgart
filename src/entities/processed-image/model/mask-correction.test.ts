import { describe, expect, it } from "vitest";

import {
  applyBrushStroke,
  brushBoundingBox,
  extractAlphaRegion,
  stampBrushAlphaInPlace,
  unionBoundingBox,
  writeAlphaRegion,
  type BrushStroke,
} from "./mask-correction";
import type { AlphaMatte } from "./types";

function makeMatte(width: number, height: number, fill: number): AlphaMatte {
  return { width, height, data: new Uint8ClampedArray(width * height).fill(fill) };
}

function alphaAt(matte: AlphaMatte, x: number, y: number): number {
  return matte.data[y * matte.width + x] ?? -1;
}

describe("applyBrushStroke", () => {
  it("pushes alpha toward 255 at the stamp center in add mode", () => {
    const matte = makeMatte(10, 10, 0);
    const original = makeMatte(10, 10, 0);
    const stroke: BrushStroke = {
      points: [{ x: 5, y: 5 }],
      radius: 3,
      hardness: 1,
      mode: "add",
    };

    const result = applyBrushStroke(matte, original, stroke);

    expect(alphaAt(result, 5, 5)).toBe(255);
  });

  it("pushes alpha toward 0 at the stamp center in erase mode", () => {
    const matte = makeMatte(10, 10, 255);
    const original = makeMatte(10, 10, 255);
    const stroke: BrushStroke = {
      points: [{ x: 5, y: 5 }],
      radius: 3,
      hardness: 1,
      mode: "erase",
    };

    const result = applyBrushStroke(matte, original, stroke);

    expect(alphaAt(result, 5, 5)).toBe(0);
  });

  it("restore mode reads back from the original matte, not 0/255", () => {
    const matte = makeMatte(10, 10, 255); // fully erased by a previous stroke
    const original = makeMatte(10, 10, 128); // model's original soft-edge output
    const stroke: BrushStroke = {
      points: [{ x: 5, y: 5 }],
      radius: 3,
      hardness: 1,
      mode: "restore",
    };

    const result = applyBrushStroke(matte, original, stroke);

    expect(alphaAt(result, 5, 5)).toBe(128);
  });

  it("leaves pixels outside the brush radius untouched", () => {
    const matte = makeMatte(10, 10, 0);
    const original = makeMatte(10, 10, 0);
    const stroke: BrushStroke = {
      points: [{ x: 5, y: 5 }],
      radius: 2,
      hardness: 1,
      mode: "add",
    };

    const result = applyBrushStroke(matte, original, stroke);

    expect(alphaAt(result, 0, 0)).toBe(0);
    expect(alphaAt(result, 9, 9)).toBe(0);
  });

  it("hardness < 1 produces a soft falloff toward the edge instead of a hard cutoff", () => {
    const matte = makeMatte(20, 20, 0);
    const original = makeMatte(20, 20, 0);
    const stroke: BrushStroke = {
      points: [{ x: 10, y: 10 }],
      radius: 8,
      hardness: 0,
      mode: "add",
    };

    const result = applyBrushStroke(matte, original, stroke);

    const center = alphaAt(result, 10, 10);
    const midway = alphaAt(result, 14, 10); // distance 4, half the radius
    const nearEdge = alphaAt(result, 17, 10); // distance 7, near the radius
    expect(center).toBe(255);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(center);
    expect(nearEdge).toBeGreaterThan(0);
    expect(nearEdge).toBeLessThan(midway);
  });

  it("does not mutate the input matte", () => {
    const matte = makeMatte(10, 10, 0);
    const original = makeMatte(10, 10, 0);
    const stroke: BrushStroke = {
      points: [{ x: 5, y: 5 }],
      radius: 3,
      hardness: 1,
      mode: "add",
    };

    applyBrushStroke(matte, original, stroke);

    expect(alphaAt(matte, 5, 5)).toBe(0);
  });

  it("applies multiple points along a stroke path", () => {
    const matte = makeMatte(20, 5, 0);
    const original = makeMatte(20, 5, 0);
    const stroke: BrushStroke = {
      points: [
        { x: 2, y: 2 },
        { x: 10, y: 2 },
        { x: 18, y: 2 },
      ],
      radius: 1,
      hardness: 1,
      mode: "add",
    };

    const result = applyBrushStroke(matte, original, stroke);

    expect(alphaAt(result, 2, 2)).toBe(255);
    expect(alphaAt(result, 10, 2)).toBe(255);
    expect(alphaAt(result, 18, 2)).toBe(255);
  });

  it("throws when matte and original dimensions differ", () => {
    const matte = makeMatte(10, 10, 0);
    const original = makeMatte(5, 5, 0);
    const stroke: BrushStroke = {
      points: [{ x: 1, y: 1 }],
      radius: 1,
      hardness: 1,
      mode: "add",
    };

    expect(() => applyBrushStroke(matte, original, stroke)).toThrow(
      /dimensions must match/,
    );
  });
});

describe("brushBoundingBox", () => {
  it("clamps to the image bounds", () => {
    expect(brushBoundingBox({ x: 0, y: 0 }, 5, 10, 10)).toEqual({
      minX: 0,
      maxX: 5,
      minY: 0,
      maxY: 5,
    });
  });

  it("returns null for a non-positive radius", () => {
    expect(brushBoundingBox({ x: 5, y: 5 }, 0, 10, 10)).toBeNull();
  });

  it("returns null when the stamp falls entirely outside the image", () => {
    expect(brushBoundingBox({ x: -50, y: -50 }, 5, 10, 10)).toBeNull();
  });
});

describe("stampBrushAlphaInPlace", () => {
  function makeRgba(width: number, height: number, alpha: number): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) rgba[pixel * 4 + 3] = alpha;
    return rgba;
  }

  it("mutates the alpha channel in place and returns the touched bounding box", () => {
    const rgba = makeRgba(10, 10, 0);
    const original = new Uint8ClampedArray(100).fill(0);

    const box = stampBrushAlphaInPlace(
      rgba,
      original,
      10,
      10,
      { x: 5, y: 5 },
      3,
      1,
      "add",
    );

    expect(box).toEqual({ minX: 2, maxX: 8, minY: 2, maxY: 8 });
    expect(rgba[(5 * 10 + 5) * 4 + 3]).toBe(255);
    // RGB channels untouched.
    expect(rgba[(5 * 10 + 5) * 4]).toBe(0);
  });

  it("matches applyBrushStroke's output for the same stroke", () => {
    const matte: AlphaMatte = { width: 10, height: 10, data: new Uint8ClampedArray(100) };
    const original: AlphaMatte = {
      width: 10,
      height: 10,
      data: new Uint8ClampedArray(100),
    };
    const stroke: BrushStroke = {
      points: [{ x: 5, y: 5 }],
      radius: 4,
      hardness: 0.3,
      mode: "add",
    };

    const viaImmutable = applyBrushStroke(matte, original, stroke);

    const rgba = makeRgba(10, 10, 0);
    stampBrushAlphaInPlace(
      rgba,
      original.data,
      10,
      10,
      stroke.points[0]!,
      stroke.radius,
      stroke.hardness,
      stroke.mode,
    );

    for (let pixel = 0; pixel < 100; pixel++) {
      expect(rgba[pixel * 4 + 3]).toBe(viaImmutable.data[pixel]);
    }
  });

  it("returns null and does nothing for a non-positive radius", () => {
    const rgba = makeRgba(10, 10, 100);
    const original = new Uint8ClampedArray(100);

    const box = stampBrushAlphaInPlace(
      rgba,
      original,
      10,
      10,
      { x: 5, y: 5 },
      0,
      1,
      "add",
    );

    expect(box).toBeNull();
    expect(rgba[(5 * 10 + 5) * 4 + 3]).toBe(100);
  });
});

describe("unionBoundingBox", () => {
  it("returns the other box when one side is null, and null when both are", () => {
    const box = { minX: 1, maxX: 2, minY: 3, maxY: 4 };

    expect(unionBoundingBox(null, box)).toBe(box);
    expect(unionBoundingBox(box, null)).toBe(box);
    expect(unionBoundingBox(null, null)).toBeNull();
  });

  it("returns the smallest box containing both inputs", () => {
    const a = { minX: 2, maxX: 5, minY: 1, maxY: 3 };
    const b = { minX: 4, maxX: 8, minY: 0, maxY: 2 };

    expect(unionBoundingBox(a, b)).toEqual({ minX: 2, maxX: 8, minY: 0, maxY: 3 });
  });
});

describe("extractAlphaRegion / writeAlphaRegion", () => {
  function makeRgbaWithAlpha(
    width: number,
    height: number,
    alphaAt: (x: number, y: number) => number,
  ): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        rgba[(y * width + x) * 4 + 3] = alphaAt(x, y);
      }
    }
    return rgba;
  }

  it("extracts the box's alpha bytes row-major, untouched pixels excluded", () => {
    const rgba = makeRgbaWithAlpha(10, 5, (x, y) => y * 10 + x);
    const box = { minX: 2, maxX: 4, minY: 1, maxY: 2 };

    const region = extractAlphaRegion(rgba, 10, box);

    expect(Array.from(region)).toEqual([12, 13, 14, 22, 23, 24]);
  });

  it("write followed by extract round-trips a region", () => {
    const rgba = makeRgbaWithAlpha(10, 5, () => 0);
    const box = { minX: 6, maxX: 8, minY: 3, maxY: 4 };
    const region = new Uint8ClampedArray([1, 2, 3, 4, 5, 6]);

    writeAlphaRegion(rgba, 10, box, region);

    expect(Array.from(extractAlphaRegion(rgba, 10, box))).toEqual([1, 2, 3, 4, 5, 6]);
    // neighbors outside the box stay untouched
    expect(rgba[(3 * 10 + 5) * 4 + 3]).toBe(0);
    expect(rgba[(2 * 10 + 6) * 4 + 3]).toBe(0);
  });

  it("writeAlphaRegion only touches the alpha channel", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(7);
    const box = { minX: 0, maxX: 3, minY: 0, maxY: 3 };

    writeAlphaRegion(rgba, 4, box, new Uint8ClampedArray(16).fill(200));

    expect(rgba[0]).toBe(7); // R untouched
    expect(rgba[3]).toBe(200); // A written
  });

  it("writeAlphaRegion rejects a region buffer that does not match the box", () => {
    const rgba = new Uint8ClampedArray(10 * 5 * 4);
    const box = { minX: 0, maxX: 2, minY: 0, maxY: 1 };

    expect(() => {
      writeAlphaRegion(rgba, 10, box, new Uint8ClampedArray(5));
    }).toThrow(/does not match box dimensions/);
  });
});
