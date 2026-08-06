import { describe, expect, it } from "vitest";

import { formatBytesLadder, formatMegabytes } from "./format-bytes";

describe("formatMegabytes", () => {
  // Pins refine-matte's formatMattingModelSize output exactly (PHASE_31 F-22).
  it("matches the matting-model call site's prior output", () => {
    const format = (bytes: number) =>
      formatMegabytes(bytes, { decimals: bytes < 50_000_000 ? 1 : 0, unitLabel: "MB" });
    expect(format(12_345_000)).toBe("12.3 MB");
    expect(format(60_000_000)).toBe("60 MB");
  });

  // Pins model-lab's formatModelSize output exactly (PHASE_31 F-22).
  it("matches the model-lab call site's prior output", () => {
    const format = (bytes: number) =>
      formatMegabytes(bytes, { decimals: 0, unitLabel: "МБ" });
    expect(format(87_654_321)).toBe("88 МБ");
    expect(format(1_000_000)).toBe("1 МБ");
  });
});

describe("formatBytesLadder", () => {
  // Pins model-storage's formatStorageBytes output exactly (PHASE_31 F-22).
  it("selects B/KB/MB/GB the same way the prior implementation did", () => {
    expect(formatBytesLadder(512)).toBe("512 B");
    expect(formatBytesLadder(2048)).toBe("2.0 KB");
    expect(formatBytesLadder(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytesLadder(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });
});
