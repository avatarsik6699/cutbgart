import { describe, expect, it } from "vitest";

import { encodedMediaType, transferableBytes } from "./worker-source-transfer";

describe("worker source transfer", () => {
  it("copies transferable bytes and validates encoded image media types", async () => {
    const source = new Uint8ClampedArray([1, 2, 3]);
    const transferred = await transferableBytes(source);
    expect([...new Uint8Array(transferred)]).toEqual([1, 2, 3]);
    expect(transferred).not.toBe(source.buffer);
    expect(encodedMediaType("image/webp")).toBe("image/webp");
    expect(() => encodedMediaType("application/octet-stream")).toThrow(
      "Unsupported source media type",
    );
  });
});
