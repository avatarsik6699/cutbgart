import { describe, expect, it } from "vitest";

import type {
  AlphaMatte,
  RefinementConstraintMap,
} from "../../../entities/processed-image";
import { buildRefinementTrimap } from "./trimap";

function matte(width: number, height: number, values: number[]): AlphaMatte {
  return { width, height, data: new Uint8ClampedArray(values) };
}

describe("buildRefinementTrimap", () => {
  it("keeps empty and full mattes definite", () => {
    expect(
      buildRefinementTrimap({ automaticMatte: matte(2, 2, [0, 0, 0, 0]) }),
    ).toMatchObject({
      unknownBounds: null,
      data: new Uint8ClampedArray([0, 0, 0, 0]),
    });
    expect(
      buildRefinementTrimap({ automaticMatte: matte(2, 2, [255, 255, 255, 255]) }),
    ).toMatchObject({ unknownBounds: null });
  });

  it("marks soft edges, holes, thin targets, and automatic/guided disagreement unknown", () => {
    const automatic = matte(5, 3, [0, 0, 0, 0, 0, 0, 255, 120, 255, 0, 0, 0, 0, 0, 0]);
    const guided = matte(5, 3, [0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0, 0]);
    const result = buildRefinementTrimap({
      automaticMatte: automatic,
      guidedMatte: guided,
      unknownRadius: 1,
    });
    expect(result.data[7]).toBe(128);
    expect(result.data[8]).toBe(128);
    expect(result.unknownBounds).not.toBeNull();
  });

  it("applies the latest hard constraint last and rejects dimension mismatches", () => {
    const constraints: RefinementConstraintMap = {
      width: 3,
      height: 1,
      data: new Int8Array([-1, 0, 1]),
    };
    const result = buildRefinementTrimap({
      automaticMatte: matte(3, 1, [0, 128, 255]),
      constraints,
      unknownRadius: 0,
    });
    expect([...result.data]).toEqual([0, 0, 255]);
    expect(() =>
      buildRefinementTrimap({
        automaticMatte: matte(2, 1, [0, 255]),
        guidedMatte: matte(1, 1, [255]),
      }),
    ).toThrow(/dimensions/);
  });
});
