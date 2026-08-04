import { describe, expect, it } from "vitest";

import { exportFileName, selectedExportDimensions } from "./export-size";

describe("v2 export sizing", () => {
  it("preserves original dimensions and privacy-neutral names", () => {
    expect(selectedExportDimensions({ width: 2200, height: 1400 }, "original")).toEqual({
      width: 2200,
      height: 1400,
    });
    expect(exportFileName("original")).toBe("cutbg-result.png");
  });

  it("scales the longest side without upscaling", () => {
    expect(selectedExportDimensions({ width: 2200, height: 1400 }, 2048)).toEqual({
      width: 2048,
      height: 1303,
    });
    expect(selectedExportDimensions({ width: 800, height: 600 }, 1024)).toEqual({
      width: 800,
      height: 600,
    });
    expect(exportFileName(1024)).toBe("cutbg-result-1024.png");
  });
});
