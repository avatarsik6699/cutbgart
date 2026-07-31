import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePendingRequestWorker } from "./use-pending-request-worker";

interface TestMessage {
  type: "result";
  requestId: string;
  value: number;
}

type TestOutcome =
  { type: "result"; value: number } | { type: "cancelled" } | { type: "crashed" };

class MockWorker extends EventTarget {
  posted: unknown[] = [];
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate = vi.fn();
  emit(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  crash() {
    this.dispatchEvent(new ErrorEvent("error"));
  }
}

afterEach(cleanup);

function setup() {
  const worker = new MockWorker();
  const factory = vi.fn(() => worker as unknown as Worker);
  const handleMessage = vi.fn();
  const { result } = renderHook(() =>
    usePendingRequestWorker<TestMessage, TestOutcome>(
      factory,
      handleMessage,
      () => ({ type: "cancelled" }) as const,
      () => ({ type: "crashed" }) as const,
    ),
  );
  return { worker, factory, result };
}

describe("usePendingRequestWorker", () => {
  it("resolves every pending request as cancelled on stopWorker()", () => {
    const { worker, result } = setup();
    act(() => {
      result.current.getWorker();
    });
    const resolveA = vi.fn();
    const resolveB = vi.fn();
    result.current.registerPending("a", resolveA);
    result.current.registerPending("b", resolveB);

    act(() => {
      result.current.stopWorker();
    });
    expect(resolveA).toHaveBeenCalledWith({ type: "cancelled" });
    expect(resolveB).toHaveBeenCalledWith({ type: "cancelled" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  // PHASE_31 T8 full-inventory finding: a hard worker crash never posted a
  // message, leaving every pending request hung forever.
  it("resolves every pending request instead of hanging when the worker crashes", () => {
    const { worker, result } = setup();
    act(() => {
      result.current.getWorker();
    });
    const resolveA = vi.fn();
    const resolveB = vi.fn();
    result.current.registerPending("a", resolveA);
    result.current.registerPending("b", resolveB);

    act(() => {
      worker.crash();
    });
    expect(resolveA).toHaveBeenCalledWith({ type: "crashed" });
    expect(resolveB).toHaveBeenCalledWith({ type: "crashed" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("recreates the worker lazily after a crash instead of reusing the dead one", () => {
    const { worker, factory, result } = setup();
    act(() => {
      result.current.getWorker();
    });
    expect(factory).toHaveBeenCalledTimes(1);

    act(() => {
      worker.crash();
    });
    act(() => {
      result.current.getWorker();
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
