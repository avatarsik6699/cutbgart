import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import { useMatteRefinement } from "./use-matte-refinement";

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

const source: SourceImage = {
  blob: new Blob(),
  width: 3,
  height: 1,
  format: "image/png",
};
const soft: AlphaMatte = {
  width: 3,
  height: 1,
  data: new Uint8ClampedArray([0, 128, 255]),
};

afterEach(cleanup);

describe("useMatteRefinement", () => {
  it("does not create a worker before explicit refinement", () => {
    const factory = vi.fn(() => new MockWorker() as unknown as Worker);
    renderHook(() => useMatteRefinement(factory));
    expect(factory).not.toHaveBeenCalled();
  });

  it("runs one request, exposes fallback, and rejects a stale result", async () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useMatteRefinement(() => worker as unknown as Worker),
    );
    act(() =>
      result.current.start({
        source,
        priorMatte: soft,
        mode: "maximum",
        path: "webgpu",
      }),
    );
    const first = worker.posted[0] as {
      request: { requestId: string; inputSize: { width: number; height: number } };
    };
    expect(first.request.inputSize).toEqual({ width: 3, height: 1 });
    act(() =>
      result.current.start({
        source,
        priorMatte: soft,
        mode: "balanced",
        path: "wasm",
      }),
    );
    const second = worker.posted[1] as {
      request: { requestId: string };
    };
    act(() => {
      worker.emit({
        type: "result",
        requestId: first.request.requestId,
        result: {
          matte: soft,
          requestedMode: "maximum",
          actualMode: "maximum",
          actualPath: "webgpu",
          inputSize: { width: 3, height: 1 },
          fallback: "none",
        },
      });
      worker.emit({
        type: "fallback",
        requestId: second.request.requestId,
        from: "maximum",
        to: "balanced",
        fromPath: "webgpu",
        toPath: "wasm",
        reason: "device lost",
      });
    });
    expect(result.current.state.status).toBe("fallback");
    act(() =>
      worker.emit({
        type: "result",
        requestId: second.request.requestId,
        result: {
          matte: soft,
          requestedMode: "balanced",
          actualMode: "balanced",
          actualPath: "wasm",
          inputSize: { width: 3, height: 1 },
          fallback: "none",
        },
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("applying"));
    expect(result.current.state.result?.requestedMode).toBe("balanced");
    act(() => result.current.finishApplying());
    expect(result.current.state.status).toBe("result");
  });

  it("skips worker creation when no unknown region exists", () => {
    const factory = vi.fn(() => new MockWorker() as unknown as Worker);
    const { result } = renderHook(() => useMatteRefinement(factory));
    act(() =>
      result.current.start({
        source,
        priorMatte: { ...soft, data: new Uint8ClampedArray([0, 0, 0]) },
        mode: "balanced",
        path: "wasm",
      }),
    );
    expect(factory).not.toHaveBeenCalled();
    expect(result.current.state.result?.actualMode).toBe("deterministic");
    expect(result.current.state.status).toBe("applying");
  });

  it("waits for an explicit disposal acknowledgement", async () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useMatteRefinement(() => worker as unknown as Worker),
    );
    act(() =>
      result.current.start({
        source,
        priorMatte: soft,
        mode: "balanced",
        path: "wasm",
      }),
    );
    let released = false;
    let promise!: Promise<void>;
    act(() => {
      promise = result.current.release().then(() => {
        released = true;
      });
    });
    const dispose = worker.posted.at(-1) as { requestId: string };
    expect(released).toBe(false);
    act(() => worker.emit({ type: "disposed", requestId: dispose.requestId }));
    await promise;
    expect(released).toBe(true);
  });

  it("clears the applied result before asynchronous lifecycle work for a warm rerun", () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useMatteRefinement(() => worker as unknown as Worker),
    );
    act(() =>
      result.current.start({
        source,
        priorMatte: soft,
        mode: "balanced",
        path: "wasm",
      }),
    );
    const request = worker.posted[0] as { request: { requestId: string } };
    act(() =>
      worker.emit({
        type: "result",
        requestId: request.request.requestId,
        result: {
          matte: soft,
          requestedMode: "balanced",
          actualMode: "balanced",
          actualPath: "wasm",
          inputSize: { width: 3, height: 1 },
          fallback: "none",
        },
      }),
    );
    expect(result.current.state.result?.matte).toBe(soft);

    act(() => result.current.prepareNext());

    expect(result.current.state.status).toBe("preparing");
    expect(result.current.state.result).toBeNull();
    expect(worker.terminate).not.toHaveBeenCalled();
  });
});
