import { describe, expect, it } from "vitest";

import { consolidateGuidedBrushStrokes } from "./guided-brush-sampling";
import { fuseGuidedBrushCandidate } from "./guided-fusion";

describe("Phase-21 guided brush fusion", () => {
  it("preserves every automatic-base byte outside the edit region", () => {
    const base = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]),
    };
    const result = fuseGuidedBrushCandidate({
      baseMatte: base,
      candidate: {
        width: 4,
        height: 2,
        data: new Uint8ClampedArray(8).fill(100),
      },
      constraints: {
        width: 4,
        height: 2,
        data: new Int8Array(8).fill(-1),
      },
      influenceMask: new Uint8Array([0, 1, 1, 0, 0, 1, 1, 0]),
      editRegion: { x: 1, y: 0, width: 2, height: 2 },
    });
    expect(result.data).toEqual(new Uint8ClampedArray([1, 100, 100, 4, 5, 100, 100, 8]));
    expect(base.data).toEqual(new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it("applies latest hard constraints after model output", () => {
    const constraints = new Int8Array(4).fill(-1);
    constraints[0] = 1;
    constraints[3] = 0;
    const result = fuseGuidedBrushCandidate({
      baseMatte: null,
      candidate: {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([0, 10, 20, 255]),
      },
      constraints: { width: 2, height: 2, data: constraints },
      influenceMask: new Uint8Array(4).fill(1),
      editRegion: { x: 0, y: 0, width: 2, height: 2 },
    });
    expect(result.data).toEqual(new Uint8ClampedArray([255, 10, 20, 0]));
  });

  it("keeps the area between separated strokes outside both local influence zones", () => {
    const width = 30;
    const height = 5;
    const consolidated = consolidateGuidedBrushStrokes(
      [
        {
          id: "left-remove",
          mode: "remove",
          points: [{ x: 0.1, y: 0.5 }],
          radius: 1,
        },
        {
          id: "right-remove",
          mode: "remove",
          points: [{ x: 0.9, y: 0.5 }],
          radius: 1,
        },
      ],
      width,
      height,
    );
    const result = fuseGuidedBrushCandidate({
      baseMatte: {
        width,
        height,
        data: new Uint8ClampedArray(width * height).fill(255),
      },
      candidate: {
        width,
        height,
        data: new Uint8ClampedArray(width * height),
      },
      constraints: consolidated.constraints,
      influenceMask: consolidated.influenceMask,
      editRegion: consolidated.editRegion!,
    });

    expect(consolidated.editRegion!.width).toBeGreaterThan(width / 2);
    expect(result.data[2 * width + Math.floor(width / 2)]).toBe(255);
    expect(result.data[2 * width + 3]).toBe(0);
    expect(result.data[2 * width + 26]).toBe(0);
  });
});
