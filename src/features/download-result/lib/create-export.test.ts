// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  availableExportSizes,
  calculateExportDimensions,
  createExport,
  createExportFileName,
  type CreateExportRuntime,
} from "./create-export";

function runtime(output = new Blob(["resized"], { type: "image/png" })) {
  const close = vi.fn();
  const drawImage = vi.fn();
  const convertToBlob = vi.fn().mockResolvedValue(output);
  const value: CreateExportRuntime = {
    decode: vi.fn().mockResolvedValue({ width: 4000, height: 2000, close }),
    createCanvas: vi.fn().mockReturnValue({
      getContext: () => ({ drawImage }),
      convertToBlob,
    }),
    yieldToBrowser: vi.fn().mockResolvedValue(undefined),
  };
  return { value, close, drawImage, convertToBlob };
}

describe("createExport", () => {
  it("filters no-upscale and duplicate size choices", () => {
    expect(availableExportSizes({ width: 4096, height: 2048 })).toEqual([
      "original",
      2048,
      1024,
    ]);
    expect(availableExportSizes({ width: 2048, height: 2048 })).toEqual([
      "original",
      1024,
    ]);
    expect(availableExportSizes({ width: 1024, height: 512 })).toEqual(["original"]);
    expect(availableExportSizes({ width: 800, height: 600 })).toEqual(["original"]);
  });

  it("preserves aspect ratio with an exact requested longest side", () => {
    expect(calculateExportDimensions({ width: 4000, height: 3000 }, 2048)).toEqual({
      width: 2048,
      height: 1536,
    });
    expect(calculateExportDimensions({ width: 1200, height: 4000 }, 1024)).toEqual({
      width: 307,
      height: 1024,
    });
    expect(calculateExportDimensions({ width: 800, height: 600 }, 2048)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("returns original PNG bytes unchanged and deterministic filenames", async () => {
    const original = new Blob(["original"], { type: "image/png" });
    const result = await createExport(
      original,
      { width: 4000, height: 3000 },
      { format: "png", longestSide: "original" },
    );
    expect(result.blob).toBe(original);
    expect(result).toMatchObject({
      width: 4000,
      height: 3000,
      fileName: "result.png",
    });
    expect(createExportFileName(2048)).toBe("result-2048.png");
  });

  it("draws the committed PNG into an asynchronously encoded downscaled canvas", async () => {
    const fake = runtime();
    const result = await createExport(
      new Blob(["committed"], { type: "image/png" }),
      { width: 4000, height: 2000 },
      { format: "png", longestSide: 1024 },
      { runtime: fake.value },
    );
    expect(fake.value.yieldToBrowser).toHaveBeenCalledOnce();
    expect(fake.value.createCanvas).toHaveBeenCalledWith(1024, 512);
    expect(fake.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1024, 512);
    expect(fake.convertToBlob).toHaveBeenCalledWith({ type: "image/png" });
    expect(fake.close).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      width: 1024,
      height: 512,
      fileName: "result-1024.png",
    });
  });

  it("cancels stale work and still closes a decoded bitmap", async () => {
    const controller = new AbortController();
    const fake = runtime();
    fake.value.createCanvas = vi.fn().mockImplementation(() => {
      controller.abort();
      return {
        getContext: () => ({ drawImage: vi.fn() }),
        convertToBlob: vi.fn(),
      };
    });
    await expect(
      createExport(
        new Blob(["committed"]),
        { width: 4000, height: 2000 },
        { format: "png", longestSide: 1024 },
        { signal: controller.signal, runtime: fake.value },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fake.close).toHaveBeenCalledOnce();
  });
});
