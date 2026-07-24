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
  const bytes = new Uint8Array(size);
  bytes.set([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x11,
    0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  return new File([bytes], "photo.jpg", {
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

  it("rejects a decompression-bomb-like header before pixel decoding", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 65_535);
    view.setUint32(20, 65_535);

    const result = await validateAndPrepareUpload(
      new File([bytes], "bomb.png", { type: "image/png" }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "exceeds-resolution-limit" },
    });
    expect(decode).not.toHaveBeenCalled();
  });
});
