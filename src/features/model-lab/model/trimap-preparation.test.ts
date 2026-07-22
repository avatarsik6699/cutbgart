import { describe, expect, it } from "vitest";

import {
  computeFocusCrop,
  createEvaluationTrimap,
  enforceTrimapConstraints,
} from "./trimap-preparation";

describe("trimap preparation", () => {
  it("creates deterministic foreground, background and unknown regions", () => {
    const groundTruth = {
      width: 5,
      height: 1,
      data: Uint8ClampedArray.from([0, 0, 128, 255, 255]),
    };
    expect(Array.from(createEvaluationTrimap(groundTruth, 0).data)).toEqual([
      0, 0, 128, 255, 255,
    ]);
  });

  it("computes a padded focus crop around the unknown region", () => {
    const trimap = {
      width: 6,
      height: 4,
      data: Uint8ClampedArray.from([
        0, 0, 0, 0, 0, 0, 0, 0, 128, 128, 0, 0, 0, 0, 128, 128, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
    };
    expect(computeFocusCrop(trimap, 1)).toEqual({ x: 1, y: 0, width: 4, height: 4 });
  });

  it("keeps explicit trimap constraints hard", () => {
    const predicted = {
      width: 3,
      height: 1,
      data: Uint8ClampedArray.from([100, 100, 100]),
    };
    const trimap = {
      width: 3,
      height: 1,
      data: Uint8ClampedArray.from([0, 128, 255]),
    };
    expect(Array.from(enforceTrimapConstraints(predicted, trimap).data)).toEqual([
      0, 100, 255,
    ]);
  });
});
