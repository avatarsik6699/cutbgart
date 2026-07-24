import { describe, expect, it } from "vitest";

import { inspectEncodedImageDimensions } from "./image-file-inspection";

function pngHeader(width: number, height: number): Blob {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new Blob([bytes], { type: "image/png" });
}

describe("encoded image inspection", () => {
  it("reads dimensions without decoding image pixels", async () => {
    await expect(
      inspectEncodedImageDimensions(pngHeader(65_535, 65_535), "image/png"),
    ).resolves.toEqual({ width: 65_535, height: 65_535 });
  });

  it("rejects a MIME-labelled malformed payload", async () => {
    await expect(
      inspectEncodedImageDimensions(
        new Blob(["not an image"], { type: "image/png" }),
        "image/png",
      ),
    ).resolves.toBeNull();
  });
});
