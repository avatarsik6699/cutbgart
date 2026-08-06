import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { ModelStorageManager } from "./ModelStorageManager";
import { getModelCacheStatus } from "../model/model-cache";

vi.mock("../model/model-cache", () => ({
  getModelCacheStatus: vi.fn(),
  clearModelCache: vi.fn(),
  formatStorageBytes: (bytes: number) => `${String(bytes)} B`,
}));

afterEach(() => cleanup());

describe("ModelStorageManager", () => {
  beforeEach(() => {
    vi.mocked(getModelCacheStatus).mockReset();
  });

  it("shows usage once loaded", async () => {
    vi.mocked(getModelCacheStatus).mockResolvedValue({
      release: "r1",
      assetCount: 1,
      usageBytes: 1024,
      cachedAssets: [
        {
          path: "onnx-community/ISNet-ONNX/resolve/rev/onnx/model_quantized.onnx",
          revision: "rev",
          byteSize: 1024,
        },
      ],
      quotaBytes: null,
      totalOriginUsageBytes: null,
    });
    render(<ModelStorageManager />);
    await waitFor(() => {
      expect(screen.getByTestId("model-storage-usage")).toBeDefined();
    });
    expect(screen.getByText(/fast background removal/i)).toBeDefined();
  });

  it("shows an intentional empty state when no model assets are cached", async () => {
    vi.mocked(getModelCacheStatus).mockResolvedValue({
      release: "r1",
      assetCount: 0,
      usageBytes: 0,
      cachedAssets: [],
      quotaBytes: null,
      totalOriginUsageBytes: null,
    });

    render(<ModelStorageManager />);

    await waitFor(() => {
      expect(screen.getByTestId("model-storage-empty")).toBeDefined();
    });
    expect(screen.queryByTestId("model-storage-details")).toBeNull();
  });

  // PHASE_31 T8 full-inventory finding: a failed initial load left no way to
  // retry short of closing/reopening the popover — the only button stayed
  // disabled because `status` was still null.
  it("offers a retry affordance when the initial load fails, without a disabled dead-end", async () => {
    vi.mocked(getModelCacheStatus).mockRejectedValueOnce(new Error("boom"));
    render(<ModelStorageManager />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
    expect(screen.queryByTestId("model-storage-usage")).toBeNull();
    const retry = screen.getByRole("button", { name: /try again/i });
    expect(retry.hasAttribute("disabled")).toBe(false);

    vi.mocked(getModelCacheStatus).mockResolvedValueOnce({
      release: "r1",
      assetCount: 1,
      usageBytes: 512,
      cachedAssets: [
        {
          path: "onnx-community/BEN2-ONNX/resolve/rev/onnx/model_fp16.onnx",
          revision: "rev",
          byteSize: 512,
        },
      ],
      quotaBytes: null,
      totalOriginUsageBytes: null,
    });
    fireEvent.click(retry);
    await waitFor(() => {
      expect(screen.getByTestId("model-storage-usage")).toBeDefined();
    });
  });
});
