import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelLabWorkerResponse } from "./types";
import { useModelLab } from "./use-model-lab";

interface PostedMessage {
  type: string;
  requestId: string;
  modelId: "isnet-q8" | "isnet-fp32" | "ben2-fp16" | "mvanet-q4";
  imageOrdinal: number;
  inferencePath: "webgpu" | "wasm";
  source: { blob: Blob };
}

class MockWorker extends EventTarget {
  static instances: MockWorker[] = [];
  posted: PostedMessage[] = [];
  active = 0;
  maxActive = 0;

  constructor() {
    super();
    MockWorker.instances.push(this);
  }

  postMessage(message: PostedMessage): void {
    this.posted.push(message);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    queueMicrotask(() => {
      this.active -= 1;
      this.emit({
        type: "result",
        requestId: message.requestId,
        modelId: message.modelId,
        imageOrdinal: message.imageOrdinal,
        result: message.source.blob,
        matte: { width: 2, height: 2, data: new Uint8ClampedArray(4).fill(255) },
        measurement: {
          imageOrdinal: message.imageOrdinal,
          modelId: message.modelId,
          requestedPath: message.inferencePath,
          actualPath: message.inferencePath,
          status: "success",
          loadMs: message.imageOrdinal === 1 ? 100 : 0,
          inferenceMs: 10,
        },
      });
    });
  }

  terminate(): void {
    // no-op
  }

  private emit(data: ModelLabWorkerResponse): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

let urlCounter = 0;

beforeEach(() => {
  MockWorker.instances = [];
  urlCounter = 0;
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 2, height: 2, close: vi.fn() }),
  );
  const NativeURL = globalThis.URL;
  class MockURL extends NativeURL {
    static override createObjectURL = vi.fn(() => `blob:test-${String(++urlCounter)}`);
    static override revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", MockURL);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function imageFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

describe("useModelLab", () => {
  it("does not create a worker until an explicit comparison run", async () => {
    const { result } = renderHook(() => useModelLab());
    await act(() => result.current.selectFiles([imageFile("private-name.jpg")]));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("runs model-major sequential comparisons and creates a filename-free export", async () => {
    const { result } = renderHook(() => useModelLab());
    await act(() =>
      result.current.selectFiles([
        imageFile("private-first.jpg"),
        imageFile("private-second.jpg"),
      ]),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(() => result.current.runComparison());
    await waitFor(() => expect(result.current.state.status).toBe("complete"));

    const worker = MockWorker.instances[0]!;
    expect(worker.maxActive).toBe(1);
    expect(
      worker.posted.map(({ modelId, imageOrdinal }) => [modelId, imageOrdinal]),
    ).toEqual([
      ["isnet-q8", 1],
      ["isnet-q8", 2],
      ["isnet-fp32", 1],
      ["isnet-fp32", 2],
      ["ben2-fp16", 1],
      ["ben2-fp16", 2],
      ["mvanet-q4", 1],
      ["mvanet-q4", 2],
    ]);
    expect(result.current.state.results).toHaveLength(8);

    act(() => {
      result.current.setPreference({ imageOrdinal: 1, preferredModelId: "ben2-fp16" });
    });
    const exported = result.current.buildExport();
    const json = JSON.stringify(exported);
    expect(exported?.imageCount).toBe(2);
    expect(json).not.toContain("private-first.jpg");
    expect(json).not.toMatch(/blob:test|sourceUrl|resultUrl/);
  });
});
