import { describe, expect, it } from "vitest";

import { deterministicRefinement } from "./deterministic-fusion";

describe("deterministicRefinement", () => {
  it("uses guided unknown pixels and applies hard constraints last", () => {
    const result = deterministicRefinement({
      priorMatte: { width: 3, height: 1, data: new Uint8ClampedArray([10, 20, 30]) },
      guidedMatte: { width: 3, height: 1, data: new Uint8ClampedArray([40, 50, 60]) },
      trimap: {
        width: 3,
        height: 1,
        data: new Uint8ClampedArray([0, 128, 255]),
        unknownBounds: { x: 1, y: 0, width: 1, height: 1 },
      },
      constraints: { width: 3, height: 1, data: new Int8Array([1, -1, 0]) },
    });
    expect([...result.data]).toEqual([255, 50, 0]);
  });
});
