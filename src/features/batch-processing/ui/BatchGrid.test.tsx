import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages";

import type { BatchItem, BatchSchedulerSnapshot } from "../model/types";
import { BatchGrid, BatchStatus } from "./BatchGrid";

const snapshot: BatchSchedulerSnapshot = {
  inferencePath: "wasm",
  concurrencyLimit: 1,
  activeCount: 0,
  queuedCount: 1,
  completedCount: 0,
  failedCount: 0,
  totalCount: 1,
};

const actions = {
  snapshot,
  onDownload: vi.fn(),
  onRetry: vi.fn(),
  onRemove: vi.fn(),
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

function makeResultItem(overrides: Partial<BatchItem> = {}): BatchItem {
  const source = {
    blob: new Blob(["image"], { type: "image/jpeg" }),
    width: 1200,
    height: 800,
    format: "image/jpeg" as const,
  };
  return makeItem({
    source,
    status: "result",
    processedImage: {
      source,
      result: new Blob(["result"], { type: "image/png" }),
      qualityMode: "fast",
    },
    ...overrides,
  });
}

const createObjectURL = vi.fn(() => "blob:batch-thumbnail");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURL);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURL);
});

afterEach(() => {
  cleanup();
  if (createObjectURL.mock.calls.length) {
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:batch-thumbnail");
  }
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.restoreAllMocks();
});

describe("BatchGrid", () => {
  it("renders a fixed filmstrip tile with a contain-fit thumbnail", async () => {
    const onSelect = vi.fn();
    render(
      <BatchGrid
        items={[makeItem({ status: "result" })]}
        selectedItemId={null}
        onSelect={onSelect}
        {...actions}
      />,
    );

    expect(screen.getByTestId("batch-filmstrip")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("batch-item-thumbnail")).toBeTruthy());
    expect(screen.getByTestId("batch-item-thumbnail").className).toContain(
      "object-contain",
    );
    expect(screen.getByText("marketplace-chair.jpg")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /select marketplace-chair\.jpg/i,
      }),
    );
    expect(onSelect).toHaveBeenCalledWith("item-1", expect.any(HTMLButtonElement));
  });

  it("makes the selected state visible and accessible", () => {
    render(
      <BatchGrid
        items={[makeItem({ status: "result" })]}
        selectedItemId="item-1"
        onSelect={vi.fn()}
        {...actions}
      />,
    );

    expect(screen.getByRole("button", { pressed: true })).toBeTruthy();
  });

  it("keeps selection and item actions as sibling buttons", async () => {
    const onDownload = vi.fn();
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <BatchGrid
        items={[makeResultItem()]}
        selectedItemId="item-1"
        snapshot={{ ...snapshot, queuedCount: 0, completedCount: 1 }}
        onSelect={vi.fn()}
        onDownload={onDownload}
        onRetry={onRetry}
        onRemove={onRemove}
      />,
    );

    const card = container.querySelector("article");
    expect(card?.querySelectorAll(":scope > button")).toHaveLength(2);
    const trigger = screen.getByTestId("batch-item-actions");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: /download png/i }));
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: /reprocess/i }));
    expect(onRetry).toHaveBeenCalledWith("item-1", trigger);

    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith("item-1", trigger);
  });

  it("offers Retry and Remove for a failed item", async () => {
    const onRetry = vi.fn();
    render(
      <BatchGrid
        items={[makeItem({ status: "error", error: "failed" })]}
        selectedItemId={null}
        snapshot={{ ...snapshot, queuedCount: 0, failedCount: 1 }}
        onSelect={vi.fn()}
        onDownload={vi.fn()}
        onRetry={onRetry}
        onRemove={vi.fn()}
      />,
    );

    const trigger = screen.getByTestId("batch-item-actions");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledWith("item-1", trigger);
  });

  it("opens an item menu from the keyboard and restores trigger focus", async () => {
    render(
      <BatchGrid
        items={[makeResultItem()]}
        selectedItemId="item-1"
        snapshot={{ ...snapshot, queuedCount: 0, completedCount: 1 }}
        onSelect={vi.fn()}
        onDownload={vi.fn()}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const trigger = screen.getByTestId("batch-item-actions");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const firstItem = await screen.findByRole("menuitem", {
      name: /download png/i,
    });
    expect(document.activeElement).toBe(firstItem);
    fireEvent.keyDown(firstItem, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
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
        selectedItemId={null}
        onSelect={onSelect}
        {...actions}
      />,
    );

    const tile = screen.getByRole("button", {
      name: new RegExp(m.batchReviewWhenReady(), "i"),
    });
    expect(tile).toHaveProperty("disabled", true);
    expect(
      screen.getByText(m.batchWaiting({ position: 1, elapsed: "1.2s" })),
    ).toBeTruthy();
    expect(screen.getByTestId("batch-item-skeleton")).toBeTruthy();
    fireEvent.click(tile);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows truthful elapsed processing time over a stage-shaped skeleton", () => {
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
        selectedItemId={null}
        onSelect={vi.fn()}
        {...actions}
      />,
    );

    expect(screen.getByText(m.batchRemoving({ elapsed: "3.2s" }))).toBeTruthy();
    expect(screen.getByTestId("batch-item-skeleton")).toBeTruthy();
  });

  it("renders scheduler metadata separately from the image gallery", () => {
    render(<BatchStatus snapshot={snapshot} />);

    expect(screen.getByTestId("scheduler-summary").textContent).toBe(
      m.batchSummary({
        active: 0,
        limit: 1,
        queued: 1,
        done: 0,
        failed: 0,
        total: 1,
      }),
    );
    expect(screen.getByText("Total 1")).toBeDefined();
    expect(screen.getByText("Queued 1")).toBeDefined();
    expect(screen.getByTestId("batch-status-bar")).toBeDefined();
  });
});
