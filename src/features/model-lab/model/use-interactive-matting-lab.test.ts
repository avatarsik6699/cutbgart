import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelLabAnyWorkerResponse } from "./types";
import { useInteractiveMattingLab } from "./use-interactive-matting-lab";

vi.mock("./matting-corpus", () => ({
  createSyntheticMattingCorpus: vi.fn().mockResolvedValue([
    {
      ordinal: 1,
      category: "hair-fur",
      source: {
        blob: new Blob([new Uint8Array([1])], { type: "image/png" }),
        width: 2,
        height: 2,
        format: "image/png",
      },
      trimap: { width: 2, height: 2, data: Uint8ClampedArray.from([0, 128, 128, 255]) },
      groundTruth: {
        width: 2,
        height: 2,
        data: Uint8ClampedArray.from([0, 128, 128, 255]),
      },
      sourceUrl: "blob:corpus-1",
    },
  ]),
}));

interface PostedMessage {
  type: "process-interactive";
  requestId: string;
  modelId: "vitmatte-small-composition1k-q8";
  caseOrdinal: number;
  inferencePath: "wasm";
}

class MockWorker extends EventTarget {
  static instances: MockWorker[] = [];
  posted: PostedMessage[] = [];
  terminated = false;

  constructor() {
    super();
    MockWorker.instances.push(this);
  }

  postMessage(message: PostedMessage): void {
    this.posted.push(message);
    queueMicrotask(() => {
      if (this.terminated) return;
      this.emit({
        type: "interactive-result",
        requestId: message.requestId,
        modelId: message.modelId,
        caseOrdinal: message.caseOrdinal,
        result: new Blob([new Uint8Array([2])], { type: "image/png" }),
        matte: { width: 2, height: 2, data: Uint8ClampedArray.from([0, 128, 128, 255]) },
        measurement: {
          caseOrdinal: message.caseOrdinal,
          modelId: message.modelId,
          requestedPath: message.inferencePath,
          actualPath: message.inferencePath,
          status: "success",
          coldLoadMs: 100,
          warmInferenceMs: 10,
          peakMemoryBytes: null,
          memoryObservation: "unavailable",
        },
      });
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  private emit(data: ModelLabAnyWorkerResponse): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
  const NativeURL = globalThis.URL;
  class MockURL extends NativeURL {
    static override createObjectURL = vi.fn(() => "blob:preview-1");
    static override revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", MockURL);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useInteractiveMattingLab", () => {
  it("requires opt-in and runs selected candidates sequentially with a safe export", async () => {
    const { result } = renderHook(() => useInteractiveMattingLab());
    expect(MockWorker.instances).toHaveLength(0);
    await act(() => result.current.loadSyntheticCorpus());
    expect(result.current.state.cases).toHaveLength(0);

    act(() => result.current.setOptedIn(true));
    await act(() => result.current.loadSyntheticCorpus());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    for (const id of [
      "vitmatte-small-composition1k-fp32",
      "vitmatte-small-distinctions646-q8",
      "vitmatte-small-distinctions646-fp32",
    ] as const) {
      act(() => result.current.setModelSelected(id, false));
    }

    await act(() => result.current.run());
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(MockWorker.instances[0]?.posted).toHaveLength(1);
    expect(result.current.state.quality[0]?.iou).toBe(1);
    const report = result.current.buildExport();
    expect(report?.schemaVersion).toBe(2);
    expect(JSON.stringify(report)).not.toMatch(/blob:|sourceUrl|groundTruth|trimap/);
  });
});
