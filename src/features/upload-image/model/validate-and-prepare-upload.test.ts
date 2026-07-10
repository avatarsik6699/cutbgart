import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateAndPrepareUpload } from "./validate-and-prepare-upload";

class MockOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return { drawImage: vi.fn() };
  }

  convertToBlob(options?: { type?: string }) {
    return Promise.resolve(
      new Blob(["downscaled"], { type: options?.type ?? "image/png" }),
    );
  }
}

function makeFile(overrides: { type?: string; size?: number } = {}): File {
  const size = overrides.size ?? 1024;
  return new File([new Uint8Array(size)], "photo.jpg", {
    type: overrides.type ?? "image/jpeg",
  });
}

function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width, height, close: vi.fn() }),
  );
}

beforeEach(() => {
  vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateAndPrepareUpload", () => {
  it("rejects an unsupported file format", async () => {
    const result = await validateAndPrepareUpload(makeFile({ type: "image/gif" }));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "unsupported-format" },
    });
  });

  it("rejects a file over the 20MB size limit", async () => {
    const result = await validateAndPrepareUpload(makeFile({ size: 21 * 1024 * 1024 }));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "exceeds-size-limit" },
    });
  });

  it("passes a within-limit image through unchanged", async () => {
    stubBitmap(800, 600);
    const file = makeFile();

    const result = await validateAndPrepareUpload(file);

    expect(result).toMatchObject({
      ok: true,
      image: { blob: file, width: 800, height: 600, format: "image/jpeg" },
    });
  });

  it("downscales an image over 4096px on the longest side instead of rejecting it", async () => {
    stubBitmap(8192, 4096);

    const result = await validateAndPrepareUpload(makeFile());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Math.max(result.image.width, result.image.height)).toBe(4096);
      expect(result.image.width).toBe(4096);
      expect(result.image.height).toBe(2048);
      expect(result.image.format).toBe("image/jpeg");
    }
  });
});
