import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BatchItem, BatchSchedulerSnapshot } from "../model/types";
import { BatchGrid } from "./BatchGrid";

const snapshot: BatchSchedulerSnapshot = {
  inferencePath: "wasm",
  concurrencyLimit: 1,
  activeCount: 0,
  queuedCount: 1,
  completedCount: 0,
  failedCount: 0,
  totalCount: 1,
};

function makeItem(overrides: Partial<BatchItem> = {}): BatchItem {
  return {
    id: "item-1",
    originalFileName: "marketplace-chair.jpg",
    source: {
      blob: new Blob(["image"], { type: "image/jpeg" }),
      width: 1200,
      height: 800,
      format: "image/jpeg",
    },
    qualityMode: "fast",
    status: "queued",
    enqueuedAt: 1,
    processingProgress: {
      stage: "queued",
      startedAt: null,
      elapsedMs: 0,
      percent: null,
    },
    ...overrides,
  };
}

const createObjectURL = vi.fn(() => "blob:batch-thumbnail");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
});

afterEach(() => {
  cleanup();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:batch-thumbnail");
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.unstubAllGlobals();
});

describe("BatchGrid", () => {
  it("shows a thumbnail, useful metadata, and an explicit selection affordance", async () => {
    const onSelect = vi.fn();
    render(
      <BatchGrid
        items={[makeItem({ status: "result" })]}
        snapshot={snapshot}
        selectedItemId={null}
        onSelect={onSelect}
        onRetry={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("batch-item-thumbnail")).toBeTruthy());
    expect(screen.getByText("1200 × 800 · Fast")).toBeTruthy();
    expect(screen.getByText("Select to review")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /select marketplace-chair\.jpg for review/i }),
    );
    expect(onSelect).toHaveBeenCalledWith("item-1");
  });

  it("makes the selected state visible and accessible", () => {
    render(
      <BatchGrid
        items={[makeItem({ status: "result" })]}
        snapshot={snapshot}
        selectedItemId="item-1"
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { pressed: true })).toBeTruthy();
    expect(screen.getByText("Selected for review")).toBeTruthy();
  });

  it("disables review while queued and explains the live queue state", () => {
    const onSelect = vi.fn();
    render(
      <BatchGrid
        items={[
          makeItem({
            processingProgress: {
              stage: "queued",
              startedAt: null,
              elapsedMs: 1_200,
              percent: null,
            },
          }),
        ]}
        snapshot={snapshot}
        selectedItemId={null}
        onSelect={onSelect}
        onRetry={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", { name: /review available when ready/i });
    expect(tile).toHaveProperty("disabled", true);
    expect(screen.getByText("Waiting · #1 in queue · 1.2s")).toBeTruthy();
    expect(screen.getByText("Review available when ready")).toBeTruthy();
    fireEvent.click(tile);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows truthful elapsed processing time with an indeterminate indicator", () => {
    render(
      <BatchGrid
        items={[
          makeItem({
            status: "processing",
            processingProgress: {
              stage: "inference",
              startedAt: 1,
              elapsedMs: 3_200,
              percent: null,
            },
          }),
        ]}
        snapshot={{ ...snapshot, activeCount: 1, queuedCount: 0 }}
        selectedItemId={null}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Removing background · 3.2s")).toBeTruthy();
    const progress = screen.getByTestId("item-stage-progress");
    expect(progress.getAttribute("value")).toBeNull();
  });
});
