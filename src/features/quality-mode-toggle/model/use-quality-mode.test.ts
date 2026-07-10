import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { QualityMode } from "../../../entities/processed-image";
import { QUALITY_MODE_STORAGE_KEY, useQualityMode } from "./use-quality-mode";

afterEach(() => {
  window.localStorage.clear();
});

describe("useQualityMode", () => {
  it("defaults to the provided defaultMode when nothing is stored", () => {
    const { result } = renderHook(() => useQualityMode("max"));

    expect(result.current.qualityMode).toBe("max");
  });

  it("uses the stored preference over defaultMode when one exists", () => {
    window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, "max");

    const { result } = renderHook(() => useQualityMode("fast"));

    expect(result.current.qualityMode).toBe("max");
  });

  it("ignores an invalid stored value and falls back to defaultMode", () => {
    window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, "ultra");

    const { result } = renderHook(() => useQualityMode("fast"));

    expect(result.current.qualityMode).toBe("fast");
  });

  it("setQualityMode updates state and persists to localStorage", () => {
    const { result } = renderHook(() => useQualityMode("fast"));

    act(() => {
      result.current.setQualityMode("max");
    });

    expect(result.current.qualityMode).toBe("max");
    expect(window.localStorage.getItem(QUALITY_MODE_STORAGE_KEY)).toBe("max");
  });

  it("tracks a later-resolving defaultMode when no preference is stored yet", () => {
    const { result, rerender } = renderHook(
      ({ defaultMode }: { defaultMode: QualityMode }) => useQualityMode(defaultMode),
      { initialProps: { defaultMode: "fast" } },
    );

    expect(result.current.qualityMode).toBe("fast");

    rerender({ defaultMode: "max" });

    expect(result.current.qualityMode).toBe("max");
  });

  it("does not override an explicit user choice when defaultMode changes later", () => {
    const { result, rerender } = renderHook(
      ({ defaultMode }: { defaultMode: QualityMode }) => useQualityMode(defaultMode),
      { initialProps: { defaultMode: "fast" } },
    );

    act(() => {
      result.current.setQualityMode("fast");
    });

    rerender({ defaultMode: "max" });

    expect(result.current.qualityMode).toBe("fast");
  });
});
