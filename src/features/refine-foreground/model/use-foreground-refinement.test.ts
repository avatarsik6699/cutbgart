import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import type { ForegroundRefinementResult } from "./types";
import { useForegroundRefinement } from "./use-foreground-refinement";

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
const matte: AlphaMatte = {
  width: 3,
  height: 1,
  data: new Uint8ClampedArray([0, 128, 255]),
};

function refinementResult(fallbackReason?: string): ForegroundRefinementResult {
  return {
    foreground: new Blob(),
    matte,
    dirtyPatch: null,
    requestedPath: "decontaminate",
    actualPath: fallbackReason ? "edge-aware-fallback" : "decontaminate",
    fallback: fallbackReason ? "no-background-samples" : "none",
    ...(fallbackReason ? { fallbackReason } : {}),
    durationMs: 12,
    memoryBytes: "unavailable",
  };
}

afterEach(cleanup);

describe("useForegroundRefinement", () => {
  it("creates the worker lazily", () => {
    const factory = vi.fn(() => new MockWorker() as unknown as Worker);
    renderHook(() => useForegroundRefinement(factory));
    expect(factory).not.toHaveBeenCalled();
  });

  it("cancels the prior request and ignores its stale result", async () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useForegroundRefinement(() => worker as unknown as Worker),
    );
    act(() => result.current.start({ source, matte }));
    const first = worker.posted[0] as { request: { requestId: string } };
    act(() => result.current.start({ source, matte, componentCleanup: false }));
    expect(worker.posted[1]).toEqual({
      type: "cancel",
      requestId: first.request.requestId,
    });
    const second = worker.posted[2] as { request: { requestId: string } };

    act(() => {
      worker.emit({
        type: "result",
        requestId: first.request.requestId,
        result: refinementResult(),
      });
      worker.emit({
        type: "fallback",
        requestId: second.request.requestId,
        fallback: "no-background-samples",
        reason: "No background sample",
      });
    });
    expect(result.current.state.status).toBe("fallback");
    act(() =>
      worker.emit({
        type: "result",
        requestId: second.request.requestId,
        result: refinementResult("No background sample"),
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("applying"));
    expect(result.current.state.result?.fallback).toBe("no-background-samples");
    act(() => result.current.finishApplying());
    expect(result.current.state.status).toBe("result");
  });

  it("waits for disposal acknowledgement and resolves pending disposal on reset", async () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useForegroundRefinement(() => worker as unknown as Worker),
    );
    act(() => result.current.start({ source, matte }));
    let released = false;
    let releasePromise!: Promise<void>;
    act(() => {
      releasePromise = result.current.release().then(() => {
        released = true;
      });
    });
    const dispose = worker.posted.at(-1) as { requestId: string };
    expect(released).toBe(false);
    act(() => worker.emit({ type: "disposed", requestId: dispose.requestId }));
    await releasePromise;
    expect(released).toBe(true);

    let resetRelease!: Promise<void>;
    act(() => {
      resetRelease = result.current.release();
      result.current.reset();
    });
    await resetRelease;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(result.current.state.status).toBe("idle");
  });

  it("clears an applied result before a warm rerun", () => {
    const worker = new MockWorker();
    const { result } = renderHook(() =>
      useForegroundRefinement(() => worker as unknown as Worker),
    );
    act(() => result.current.start({ source, matte }));
    const request = worker.posted[0] as { request: { requestId: string } };
    act(() =>
      worker.emit({
        type: "result",
        requestId: request.request.requestId,
        result: refinementResult(),
      }),
    );
    expect(result.current.state.result).not.toBeNull();
    act(() => result.current.prepareNext());
    expect(result.current.state.status).toBe("preparing");
    expect(result.current.state.result).toBeNull();
    expect(worker.terminate).not.toHaveBeenCalled();
  });
});
