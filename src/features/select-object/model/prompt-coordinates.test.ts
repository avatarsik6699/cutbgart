import { describe, expect, it } from "vitest";
import {
  bestIouMatte,
  displayPointToNormalized,
  normalizedPromptToPixels,
} from "./prompt-coordinates";

describe("guided prompt geometry", () => {
  it("maps responsive display coordinates and clamps outside input", () => {
    expect(
      displayPointToNormalized(150, 100, { left: 50, top: 50, width: 200, height: 100 }),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(
      displayPointToNormalized(0, 999, { left: 50, top: 50, width: 200, height: 100 }),
    ).toEqual({ x: 0, y: 1 });
  });

  it("normalizes box direction and scales to source pixels", () => {
    expect(
      normalizedPromptToPixels(
        { type: "box", xMin: 0.8, yMin: 0.7, xMax: 0.2, yMax: 0.1 },
        1000,
        500,
      ),
    ).toEqual({ type: "box", xMin: 200, yMin: 50, xMax: 800, yMax: 350 });
  });

  it("selects the highest-IoU source-sized mask", () => {
    expect(bestIouMatte([1, 0, 0, 1, 0, 1, 1, 0], [0.2, 0.9], 2, 2).data).toEqual(
      new Uint8ClampedArray([0, 255, 255, 0]),
    );
  });
});
