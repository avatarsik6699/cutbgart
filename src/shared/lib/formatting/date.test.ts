import { describe, expect, it } from "vitest";

import { currentLocalYear, formatLocalTime } from "./date";

describe("date formatting", () => {
  it("formats a validated timestamp with an explicit 24-hour time policy", () => {
    const result = formatLocalTime(new Date(2026, 7, 6, 13, 5, 9).getTime());

    expect(result).toMatch(/13:05:09/);
  });

  it("returns a stable fallback for invalid timestamps", () => {
    expect(formatLocalTime(Number.NaN)).toBe("—");
    expect(currentLocalYear(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("reads the local calendar year from an injected timestamp", () => {
    expect(currentLocalYear(new Date(2026, 6, 1).getTime())).toBe("2026");
  });
});
