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
  it("forces BEN2 batches to one active inference", async () => {
    const worker = new FakeWorker();
    const workerFactory = () => worker as unknown as Worker;
    const { result } = renderHook(() =>
      useBatchProcessing({
        qualityMode: "ben2-fp16",
        inferencePath: "webgpu",
        workerFactory,
      }),
    );
    act(() =>
      result.current.enqueue(
        [1, 2].map((number) => ({ fileName: `${number}.jpg`, source })),
      ),
    );
    await waitFor(() =>
      expect(worker.posted.some((message) => message.type === "load-model")).toBe(true),
    );
    act(() =>
      worker.emit({
        type: "model-ready",
        qualityMode: "ben2-fp16",
        inferencePath: "webgpu",
        dtype: "fp16",
      }),
    );
    await waitFor(() =>
      expect(worker.posted.filter((message) => message.type === "process")).toHaveLength(
        1,
      ),
    );
    expect(result.current.snapshot.concurrencyLimit).toBe(1);
  });

  it("settles active work before dispatching a different model mode", async () => {
    const worker = new FakeWorker();
    const workerFactory = () => worker as unknown as Worker;
    const { result, rerender } = renderHook(
      ({ qualityMode }: { qualityMode: "isnet-q8" | "isnet-fp32" }) =>
        useBatchProcessing({ qualityMode, inferencePath: "webgpu", workerFactory }),
      { initialProps: { qualityMode: "isnet-q8" as "isnet-q8" | "isnet-fp32" } },
    );
    act(() => result.current.enqueue([{ fileName: "q8.jpg", source }]));
    await waitFor(() =>
      expect(worker.posted.some((message) => message.type === "load-model")).toBe(true),
    );
    act(() =>
      worker.emit({
        type: "model-ready",
        qualityMode: "isnet-q8",
        inferencePath: "webgpu",
        dtype: "q8",
      }),
    );
    await waitFor(() =>
      expect(worker.posted.filter((message) => message.type === "process")).toHaveLength(
        1,
      ),
    );
    const first = worker.posted.find((message) => message.type === "process")!;
    rerender({ qualityMode: "isnet-fp32" });
    act(() => result.current.enqueue([{ fileName: "fp32.jpg", source }]));
    expect(worker.posted.filter((message) => message.type === "process")).toHaveLength(1);
    act(() =>
      worker.emit({
        type: "process-result",
        requestId: first.requestId,
        result: new Blob(["png"]),
        matte: { width: 1, height: 1, data: new Uint8ClampedArray([255]) },
        durationMs: 1,
      }),
    );
    await waitFor(() =>
      expect(worker.posted.filter((message) => message.type === "process")).toHaveLength(
        2,
      ),
    );
    expect(
      worker.posted.filter((message) => message.type === "process")[1]?.qualityMode,
    ).toBe("isnet-fp32");
  });
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
