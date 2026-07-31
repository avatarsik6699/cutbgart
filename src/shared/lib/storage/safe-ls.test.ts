import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { safeLs } from "./safe-ls";

describe("safeLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a value through localStorage", () => {
    safeLs.setItem("phase-31-test", "value");
    expect(safeLs.getItem("phase-31-test")).toBe("value");
    safeLs.removeItem("phase-31-test");
    expect(safeLs.getItem("phase-31-test")).toBeNull();
  });

  it("returns null instead of throwing when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(safeLs.getItem("phase-31-test")).toBeNull();
    expect(() => safeLs.setItem("phase-31-test", "value")).not.toThrow();
    expect(() => safeLs.removeItem("phase-31-test")).not.toThrow();
  });

  describe("when localStorage throws (quota exceeded or disabled)", () => {
    beforeEach(() => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      });
    });

    it("degrades to null/no-op instead of throwing", () => {
      expect(safeLs.getItem("phase-31-test")).toBeNull();
      expect(() => safeLs.setItem("phase-31-test", "value")).not.toThrow();
      expect(() => safeLs.removeItem("phase-31-test")).not.toThrow();
    });
  });
});
