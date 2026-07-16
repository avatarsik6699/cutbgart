import { describe, expect, it } from "vitest";
import { fuseGuidedMattes, unionAcceptedLayerMasks } from "./guided-fusion";
import type { ObjectMaskLayer } from "./types";

function layer(
  id: string,
  data: number[],
  strokes: ObjectMaskLayer["strokes"] = [],
): ObjectMaskLayer {
  const matte = { width: 2, height: 2, data: new Uint8ClampedArray(data) };
  return {
    id,
    points: [],
    targetBox: null,
    strokes,
    candidates: [{ id: `${id}-c`, matte, score: 1, differenceRatio: 0 }],
    selectedCandidateId: `${id}-c`,
    acceptedMatte: matte,
  };
}

describe("guided fusion", () => {
  it("unions accepted object layers", () => {
    expect(
      unionAcceptedLayerMasks(
        [layer("a", [255, 0, 0, 0]), layer("b", [0, 0, 0, 255])],
        2,
        2,
      )?.data,
    ).toEqual(new Uint8ClampedArray([255, 0, 0, 255]));
  });

  it("preserves the base outside a local region and applies hard constraints last", () => {
    const result = fuseGuidedMattes({
      baseMatte: { width: 2, height: 2, data: new Uint8ClampedArray([10, 20, 30, 40]) },
      layers: [
        layer(
          "a",
          [0, 0, 0, 0],
          [{ id: "keep", mode: "keep", points: [{ x: 0, y: 0 }], radius: 1 }],
        ),
      ],
      width: 2,
      height: 2,
      localUpdate: {
        matte: { width: 2, height: 2, data: new Uint8ClampedArray([1, 2, 3, 4]) },
        region: { xMin: 0.5, yMin: 0.5, xMax: 1, yMax: 1 },
      },
    });
    expect(result.data[0]).toBe(255);
    expect(result.data[3]).toBe(4);
  });

  it("lets guided background intent replace the automatic base only inside its box", () => {
    const removing = layer("remove", [0, 0, 0, 0]);
    removing.targetBox = { xMin: 0, yMin: 0, xMax: 0.5, yMax: 0.5 };
    const result = fuseGuidedMattes({
      baseMatte: {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([255, 255, 255, 255]),
      },
      layers: [removing],
      width: 2,
      height: 2,
    });
    expect(result.data).toEqual(new Uint8ClampedArray([0, 255, 255, 255]));
  });
});
