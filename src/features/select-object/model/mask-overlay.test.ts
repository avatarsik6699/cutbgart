import { describe, expect, it } from "vitest";

import { createMaskOverlayPixels } from "./mask-overlay";

describe("createMaskOverlayPixels", () => {
  it("resamples the matte at display resolution and leaves background transparent", () => {
    const pixels = createMaskOverlayPixels(
      {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([0, 255]),
      },
      4,
      1,
    );

    expect(Array.from(pixels.filter((_, index) => index % 4 === 3))).toEqual([
      0, 0, 115, 115,
    ]);
    expect(Array.from(pixels.slice(8, 11))).toEqual([14, 165, 233]);
  });
});
