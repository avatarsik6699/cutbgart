import { describe, expect, it } from "vitest";

import { formatStorageBytes } from "./model-cache";

describe("model cache formatting", () => {
  it("formats approximate storage without exposing model identities", () => {
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(1536)).toBe("1.5 KB");
    expect(formatStorageBytes(10 * 1024 * 1024)).toBe("10.0 MB");
    expect(formatStorageBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });
});
