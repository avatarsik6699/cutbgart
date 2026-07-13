import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { QualityMode } from "../../../entities/processed-image";
import { QUALITY_MODE_STORAGE_KEY, useQualityMode } from "./use-quality-mode";

afterEach(() => {
  window.localStorage.clear();
});

describe("useQualityMode", () => {
  it("defaults to the provided defaultMode when nothing is stored", () => {
    const { result } = renderHook(() => useQualityMode("max"));

    expect(result.current.qualityMode).toBe("isnet-fp32");
  });

  it("uses the stored preference over defaultMode when one exists", async () => {
    window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, "max");

    const { result } = renderHook(() => useQualityMode("fast"));

    await waitFor(() => expect(result.current.qualityMode).toBe("isnet-fp32"));
  });

  it("ignores an invalid stored value and falls back to defaultMode", () => {
    window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, "ultra");

    const { result } = renderHook(() => useQualityMode("fast"));

    expect(result.current.qualityMode).toBe("isnet-q8");
  });

  it("setQualityMode updates state and persists to localStorage", () => {
    const { result } = renderHook(() => useQualityMode("fast"));

    act(() => {
      result.current.setQualityMode("isnet-fp32");
    });

    expect(result.current.qualityMode).toBe("isnet-fp32");
    expect(window.localStorage.getItem(QUALITY_MODE_STORAGE_KEY)).toBe("max");
  });

  it("tracks a later-resolving defaultMode when no preference is stored yet", () => {
    const { result, rerender } = renderHook(
      ({ defaultMode }: { defaultMode: QualityMode }) => useQualityMode(defaultMode),
      { initialProps: { defaultMode: "fast" } },
    );

    expect(result.current.qualityMode).toBe("isnet-q8");

    rerender({ defaultMode: "max" });

    expect(result.current.qualityMode).toBe("isnet-fp32");
  });

  it("does not override an explicit user choice when defaultMode changes later", () => {
    const { result, rerender } = renderHook(
      ({ defaultMode }: { defaultMode: QualityMode }) => useQualityMode(defaultMode),
      { initialProps: { defaultMode: "fast" } },
    );

    act(() => {
      result.current.setQualityMode("isnet-q8");
    });

    rerender({ defaultMode: "max" });

    expect(result.current.qualityMode).toBe("isnet-q8");
  });

  it("keeps BEN2 session-only without changing the IS-Net preference", () => {
    window.localStorage.setItem(QUALITY_MODE_STORAGE_KEY, "max");
    const { result } = renderHook(() => useQualityMode("fast"));
    act(() => result.current.setQualityMode("ben2-fp16"));
    expect(result.current.qualityMode).toBe("ben2-fp16");
    expect(window.localStorage.getItem(QUALITY_MODE_STORAGE_KEY)).toBe("max");
  });
});
