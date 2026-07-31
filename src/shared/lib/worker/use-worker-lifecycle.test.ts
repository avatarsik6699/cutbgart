import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWorkerLifecycle } from "./use-worker-lifecycle";

interface TestMessage {
  type: "progress" | "result" | "disposed";
  requestId: string;
  value?: number;
}

class MockWorker extends EventTarget {
  posted: unknown[] = [];
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate = vi.fn();
  emit(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

afterEach(cleanup);

describe("useWorkerLifecycle", () => {
  it("creates the worker lazily, only on first getWorker() call", () => {
    const factory = vi.fn(() => new MockWorker() as unknown as Worker);
    const { result } = renderHook(() =>
      useWorkerLifecycle<TestMessage>(factory, vi.fn()),
    );
    expect(factory).not.toHaveBeenCalled();

    act(() => {
      result.current.getWorker();
    });
    expect(factory).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.getWorker();
    });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("only delivers messages matching the active request, ignoring stale ones", () => {
    const worker = new MockWorker();
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWorkerLifecycle<TestMessage>(() => worker as unknown as Worker, onMessage),
    );

    act(() => {
      result.current.getWorker();
      result.current.setActiveRequest("current");
    });
    act(() => worker.emit({ type: "progress", requestId: "stale", value: 1 }));
    expect(onMessage).not.toHaveBeenCalled();

    act(() => worker.emit({ type: "progress", requestId: "current", value: 2 }));
    expect(onMessage).toHaveBeenCalledWith({
      type: "progress",
      requestId: "current",
      value: 2,
    });
  });

  it("resolves disposal acknowledgement without forwarding it to onMessage", async () => {
    const worker = new MockWorker();
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWorkerLifecycle<TestMessage>(() => worker as unknown as Worker, onMessage),
    );
    act(() => {
      result.current.getWorker();
    });

    let released = false;
    const releasePromise = result.current.release().then(() => {
      released = true;
    });
    const dispose = worker.posted.at(-1) as { requestId: string };
    expect(released).toBe(false);

    act(() => worker.emit({ type: "disposed", requestId: dispose.requestId }));
    await releasePromise;
    expect(released).toBe(true);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("cancelActive posts a cancel message only when a request is active", () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useWorkerLifecycle<TestMessage>(() => worker as unknown as Worker, vi.fn()),
    );

    act(() => {
      result.current.cancelActive();
    });
    expect(worker.posted).toHaveLength(0);

    act(() => {
      result.current.getWorker();
      result.current.setActiveRequest("req-1");
      result.current.cancelActive();
    });
    expect(worker.posted).toEqual([{ type: "cancel", requestId: "req-1" }]);
    expect(result.current.activeRequestRef.current).toBeNull();
  });

  it("terminate() clears the worker, cancels the active request, and resolves pending disposals", async () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useWorkerLifecycle<TestMessage>(() => worker as unknown as Worker, vi.fn()),
    );

    act(() => {
      result.current.getWorker();
      result.current.setActiveRequest("req-1");
    });
    let released = false;
    const releasePromise = result.current.release().then(() => {
      released = true;
    });

    act(() => {
      result.current.terminate();
    });
    await releasePromise;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(released).toBe(true);
    expect(result.current.activeRequestRef.current).toBeNull();
  });

  it("terminates the worker on unmount", () => {
    const worker = new MockWorker();
    const { result, unmount } = renderHook(() =>
      useWorkerLifecycle<TestMessage>(() => worker as unknown as Worker, vi.fn()),
    );
    act(() => {
      result.current.getWorker();
    });

    unmount();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("nextRequestId returns unique, prefixed, incrementing ids", () => {
    const { result } = renderHook(() =>
      useWorkerLifecycle<TestMessage>(
        () => new MockWorker() as unknown as Worker,
        vi.fn(),
      ),
    );
    const first = result.current.nextRequestId("dispose");
    const second = result.current.nextRequestId("dispose");
    expect(first).not.toBe(second);
    expect(first.startsWith("dispose-")).toBe(true);
  });
});
