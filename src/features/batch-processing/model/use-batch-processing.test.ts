import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useBatchProcessing } from "./use-batch-processing";

class FakeWorker extends EventTarget {
  posted: Array<Record<string, unknown>> = [];
  terminated = false;
  postMessage(message: Record<string, unknown>) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

const source = {
  blob: new Blob(["image"], { type: "image/jpeg" }),
  width: 1,
  height: 1,
  format: "image/jpeg" as const,
};

describe("useBatchProcessing", () => {
  it("keeps the batch worker when the global mode changes", async () => {
    const worker = new FakeWorker();
    const workerFactory = () => worker as unknown as Worker;
    const { result, rerender } = renderHook(
      ({ qualityMode }: { qualityMode: "fast" | "max" }) =>
        useBatchProcessing({
          qualityMode,
          inferencePath: "wasm",
          workerFactory,
        }),
      { initialProps: { qualityMode: "fast" as "fast" | "max" } },
    );

    act(() => result.current.enqueue([{ fileName: "fast.jpg", source }]));
    await waitFor(() => expect(worker.posted.length).toBeGreaterThan(0));
    rerender({ qualityMode: "max" });

    expect(worker.terminated).toBe(false);
    expect(result.current.session.items[0]?.qualityMode).toBe("fast");
  });

  it("ignores selection until an item has a result", () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useBatchProcessing({
        qualityMode: "fast",
        inferencePath: "wasm",
        workerFactory: () => worker as unknown as Worker,
      }),
    );

    act(() => result.current.enqueue([{ fileName: "queued.jpg", source }]));
    const id = result.current.session.items[0]?.id;
    if (!id) throw new Error("Expected an enqueued item");
    act(() => result.current.selectItem(id));
    expect(result.current.session.selectedItemId).toBeNull();
  });

  it.each([
    ["wasm", 1],
    ["webgpu", 2],
  ] as const)(
    "limits %s inference to %i and releases a failed slot",
    async (inferencePath, limit) => {
      const worker = new FakeWorker();
      const workerFactory = () => worker as unknown as Worker;
      const { result } = renderHook(
        () =>
          useBatchProcessing({
            qualityMode: "fast",
            inferencePath,
            workerFactory,
          }),
        { wrapper: StrictMode },
      );
      act(() =>
        result.current.enqueue(
          [1, 2, 3].map((number) => ({ fileName: `${number}.jpg`, source })),
        ),
      );
      await waitFor(() =>
        expect(worker.posted.some((message) => message.type === "load-model")).toBe(true),
      );
      act(() =>
        worker.emit({
          type: "model-ready",
          qualityMode: "fast",
          inferencePath,
          dtype: "mock",
        }),
      );
      await waitFor(() =>
        expect(
          worker.posted.filter((message) => message.type === "process"),
        ).toHaveLength(limit),
      );
      expect(
        result.current.session.items.filter((item) => item.status === "processing"),
      ).toHaveLength(limit);
      const first = worker.posted.find((message) => message.type === "process")!;
      act(() =>
        worker.emit({
          type: "error",
          requestId: first.requestId,
          code: "processing-failed",
          message: "boom",
        }),
      );
      await waitFor(() =>
        expect(
          worker.posted.filter((message) => message.type === "process"),
        ).toHaveLength(limit + 1),
      );
      expect(result.current.snapshot.failedCount).toBe(1);
      expect(result.current.snapshot.activeCount).toBeLessThanOrEqual(limit);
    },
  );
});
