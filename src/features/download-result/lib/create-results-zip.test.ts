// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createResultsZip, createUniqueResultNames } from "./create-results-zip";

describe("createUniqueResultNames", () => {
  it("replaces source filenames with deterministic export names", () => {
    expect(
      createUniqueResultNames([
        { originalFileName: "../my photo.jpg" },
        { originalFileName: "my photo.png" },
        { originalFileName: "..." },
      ]),
    ).toEqual(["cutbg-result-1.png", "cutbg-result-2.png", "cutbg-result-3.png"]);
  });

  it("stores completed PNG bytes unchanged in the archive", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
    const blob = await createResultsZip([
      {
        originalFileName: "photo.jpg",
        processedImage: { result: new Blob([png], { type: "image/png" }) },
      },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0); // ZIP store/pass-through, no DEFLATE
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const dataOffset = 30 + nameLength + extraLength;
    expect(bytes.slice(dataOffset, dataOffset + png.length)).toEqual(png);
    expect(new TextDecoder().decode(bytes)).not.toContain("photo.jpg");
  });
});
