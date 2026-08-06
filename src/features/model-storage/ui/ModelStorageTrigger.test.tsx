import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelStorageTrigger } from "./ModelStorageTrigger";

vi.mock("../model/model-cache", () => ({
  getModelCacheStatus: vi.fn().mockResolvedValue({
    release: "r1",
    assetCount: 0,
    usageBytes: 0,
    cachedAssets: [],
    quotaBytes: null,
    totalOriginUsageBytes: null,
  }),
  clearModelCache: vi.fn(),
  formatStorageBytes: (bytes: number) => `${String(bytes)} B`,
}));

afterEach(cleanup);

describe("ModelStorageTrigger", () => {
  it("mounts the lazily loaded manager only after the popover opens", async () => {
    render(<ModelStorageTrigger />);

    expect(screen.queryByTestId("model-storage-manager")).toBeNull();
    fireEvent.click(screen.getByTestId("model-storage-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("model-storage-manager")).toBeDefined();
    });
  });
});
