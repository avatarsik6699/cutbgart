import { describe, expect, it, vi } from "vitest";

import { IMAGE_IMPORT_MAX_BYTES, prepareImageImport } from "./image-import-preparation";

function pngWithDimensions(width: number, height: number): File {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], "input.png", { type: "image/png" });
}

describe("image import preparation", () => {
  it("accepts bounded PNG dimensions and downscales oversized dimensions", async () => {
    await expect(prepareImageImport(pngWithDimensions(4096, 1))).resolves.toMatchObject({
      ok: true,
    });
    const resize = vi.fn(() =>
      Promise.resolve(new Blob(["scaled"], { type: "image/png" })),
    );
    await expect(
      prepareImageImport(pngWithDimensions(8192, 4096), {
        resize,
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { width: 4096, height: 2048, mediaType: "image/png" },
    });
    expect(resize).toHaveBeenCalledWith(
      expect.any(File),
      4096,
      2048,
      "image/png",
      undefined,
    );
  });

  it("rejects encoded input above twenty MiB before dimension inspection", async () => {
    const oversized = new File(
      [new Uint8Array(IMAGE_IMPORT_MAX_BYTES + 1)],
      "oversized.png",
      { type: "image/png" },
    );
    await expect(prepareImageImport(oversized)).resolves.toEqual({
      ok: false,
      error: "exceeds-size-limit",
    });
  });
});
