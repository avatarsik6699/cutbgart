import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { detectDeviceCapabilities } from "./device-capabilities";
import { useBackgroundRemoval } from "./useBackgroundRemoval";

// `detectDeviceCapabilities()` now always resolves "wasm" (BiRefNet's WebGPU
// incompatibility — see device-capabilities.ts). Mock it per-test where a
// "webgpu" starting state is needed to exercise the hook's own mid-session
// fallback handling in isolation from that device-capability decision.
vi.mock("./device-capabilities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./device-capabilities")>();
  return { ...actual, detectDeviceCapabilities: vi.fn(actual.detectDeviceCapabilities) };
});

interface PostedMessage {
  type: string;
  requestId?: string;
  [key: string]: unknown;
}

class MockWorker extends EventTarget {
  static instances: MockWorker[] = [];
  posted: PostedMessage[] = [];

  constructor() {
    super();
    MockWorker.instances.push(this);
  }

  postMessage(message: PostedMessage): void {
    this.posted.push(message);
  }

  terminate(): void {
    // no-op
  }

  emit(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function makeFile(overrides: { type?: string; size?: number } = {}): File {
  const size = overrides.size ?? 1024;
  return new File([new Uint8Array(size)], "photo.jpg", {
    type: overrides.type ?? "image/jpeg",
  });
}

let track: Mock<(event: string, data?: unknown) => void>;

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }),
  );
  track = vi.fn<(event: string, data?: unknown) => void>();
  window.umami = { track };
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.umami;
});

describe("useBackgroundRemoval", () => {
  it("rejects an unsupported file format without touching the worker", async () => {
    const { result } = renderHook(() => useBackgroundRemoval());

    act(() => {
      result.current.selectFile(makeFile({ type: "image/gif" }));
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));

    expect(result.current.state).toMatchObject({
      status: "error",
      error: { code: "unsupported-format", action: "reset" },
    });
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("rejects an oversized file without touching the worker", async () => {
    const { result } = renderHook(() => useBackgroundRemoval());

    act(() => {
      result.current.selectFile(makeFile({ size: 21 * 1024 * 1024 }));
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));

    expect(result.current.state).toMatchObject({
      status: "error",
      error: { code: "file-too-large", action: "reset" },
    });
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("drives the full pipeline: model-loading -> ready -> processing -> result", async () => {
    const { result } = renderHook(() => useBackgroundRemoval());

    act(() => {
      result.current.selectFile(makeFile());
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;

    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );
    expect(result.current.state.status).toBe("model-loading");
    expect(track).toHaveBeenCalledWith("model_load_started", undefined);

    act(() => {
      worker.emit({ type: "model-progress", qualityMode: "fast", percent: 50 });
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: "model-loading",
        progress: 50,
      }),
    );

    act(() => {
      worker.emit({ type: "model-ready", qualityMode: "fast" });
    });

    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "process")).toBe(true),
    );
    expect(result.current.state.status).toBe("processing");
    expect(track).toHaveBeenCalledWith("model_load_completed", undefined);
    expect(track).toHaveBeenCalledWith("processing_started", undefined);

    const processRequest = worker.posted.find((m) => m.type === "process");
    const resultBlob = new Blob(["fake-png"], { type: "image/png" });

    act(() => {
      worker.emit({
        type: "process-result",
        requestId: processRequest?.requestId,
        result: resultBlob,
      });
    });

    await waitFor(() => expect(result.current.state.status).toBe("result"));
    if (result.current.state.status === "result") {
      expect(result.current.state.result.qualityMode).toBe("fast");
      expect(result.current.state.result.result).toBe(resultBlob);
    }
    expect(track).toHaveBeenCalledWith("processing_completed", undefined);

    // "Recompute in max quality" re-enters model-loading from `result`, not
    // idle/error — it must not count as a fresh model_load_started (SPEC.md
    // §7.6), even though it still fires model_load_completed/processing_started.
    track.mockClear();
    act(() => {
      result.current.recomputeMaxQuality();
    });
    await waitFor(() => expect(result.current.state.status).toBe("model-loading"));
    expect(track).not.toHaveBeenCalledWith("model_load_started", undefined);
  });

  it("turns on lightweightMode when the worker reports a mid-inference WebGPU fallback", async () => {
    // `detectDeviceCapabilities()` always resolves "wasm" now (BiRefNet's
    // WebGPU incompatibility), so a "webgpu" starting state — needed here to
    // prove lightweightMode starts off and only flips on the worker's
    // mid-session fallback message — has to be mocked directly rather than
    // simulated via navigator.gpu.
    vi.mocked(detectDeviceCapabilities).mockResolvedValueOnce({
      inferencePath: "webgpu",
      defaultQualityMode: "max",
    });

    const { result } = renderHook(() => useBackgroundRemoval());
    await waitFor(() =>
      expect(result.current.deviceCapabilities?.inferencePath).toBe("webgpu"),
    );
    expect(result.current.lightweightMode).toBe(false);

    act(() => {
      result.current.selectFile(makeFile());
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );

    act(() => {
      worker.emit({ type: "model-ready", qualityMode: "max" });
    });
    act(() => {
      worker.emit({ type: "fallback-to-wasm", qualityMode: "max" });
    });

    await waitFor(() => expect(result.current.lightweightMode).toBe(true));
  });

  it("surfaces a worker error with a retry action, and retry() re-issues the request", async () => {
    const { result } = renderHook(() => useBackgroundRemoval());

    act(() => {
      result.current.selectFile(makeFile());
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );

    act(() => {
      worker.emit({ type: "error", code: "model-load-failed", message: "network down" });
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      status: "error",
      error: { code: "model-load-failed", action: "retry" },
    });
    expect(track).toHaveBeenCalledWith("model_load_failed", undefined);

    act(() => {
      result.current.retry();
    });

    await waitFor(() =>
      expect(worker.posted.filter((m) => m.type === "load-model")).toHaveLength(2),
    );
    expect(result.current.state.status).toBe("model-loading");
  });

  it("attributes a worker error during processing to processing_failed, not model_load_failed", async () => {
    const { result } = renderHook(() => useBackgroundRemoval());

    act(() => {
      result.current.selectFile(makeFile());
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );

    act(() => {
      worker.emit({ type: "model-ready", qualityMode: "fast" });
    });
    await waitFor(() => expect(result.current.state.status).toBe("processing"));
    track.mockClear();

    act(() => {
      worker.emit({ type: "error", code: "processing-failed", message: "OOM" });
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(track).toHaveBeenCalledWith("processing_failed", undefined);
    expect(track).not.toHaveBeenCalledWith("model_load_failed", undefined);
  });

  it("reset() returns to idle", async () => {
    const { result } = renderHook(() => useBackgroundRemoval());

    act(() => {
      result.current.selectFile(makeFile({ type: "image/gif" }));
    });
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({ status: "idle" });
  });
});
