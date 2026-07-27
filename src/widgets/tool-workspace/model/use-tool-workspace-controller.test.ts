import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SourceImage } from "../../../entities/processed-image";
import { useToolWorkspaceController } from "./use-tool-workspace-controller";

interface PostedMessage {
  type: string;
  requestId?: string;
  [key: string]: unknown;
}

class MockWorker extends EventTarget {
  static instances: MockWorker[] = [];
  posted: PostedMessage[] = [];
  terminated = false;

  constructor() {
    super();
    MockWorker.instances.push(this);
  }

  postMessage(message: PostedMessage) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

const source = (value: string): SourceImage => ({
  blob: new Blob(
    [
      new Uint8Array([
        0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x02, 0x03, 0x01,
        0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      ]),
      value,
    ],
    { type: "image/jpeg" },
  ),
  width: 2,
  height: 2,
  format: "image/jpeg",
});

async function completeAutomaticRun(
  result: { readonly current: ReturnType<typeof useToolWorkspaceController> },
  input: SourceImage,
) {
  act(() => result.current.handleUpload({ ok: true, image: input }));
  await waitFor(() =>
    expect(
      MockWorker.instances
        .flatMap((worker) => worker.posted)
        .some((message) => message.type === "load-model"),
    ).toBe(true),
  );
  const worker = MockWorker.instances.find((candidate) =>
    candidate.posted.some((message) => message.type === "load-model"),
  );
  if (!worker) throw new Error("Expected automatic inference worker");
  act(() =>
    worker.emit({
      type: "model-ready",
      qualityMode: "isnet-q8",
      inferencePath: "wasm",
      dtype: "q8",
    }),
  );
  await waitFor(() =>
    expect(worker.posted.some((message) => message.type === "process")).toBe(true),
  );
  const process = worker.posted.find((message) => message.type === "process");
  act(() =>
    worker.emit({
      type: "process-result",
      requestId: process?.requestId,
      result: new Blob(["automatic"]),
      matte: {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([255, 255, 0, 0]),
      },
      durationMs: 1,
    }),
  );
  await waitFor(() => expect(result.current.singleDocument).not.toBeNull());
}

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 2, height: 2, close: vi.fn() }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("useToolWorkspaceController", () => {
  it("adopts a successful result, commits a background operation, and releases on reset", async () => {
    const { result } = renderHook(() => useToolWorkspaceController());
    await completeAutomaticRun(result, source("first"));
    const scope = result.current.singleDocument;
    if (!scope || result.current.state.status !== "result")
      throw new Error("Expected a completed edit document");
    const currentImage = result.current.state.result;
    act(() =>
      result.current.commitSingleBackground({
        ...currentImage,
        result: new Blob(["background"]),
        backgroundFill: { type: "color", value: "#ffffff" },
      }),
    );
    expect(result.current.singleDocument?.history.past).toHaveLength(1);
    expect(result.current.singleDocument?.history.past[0]).toMatchObject({
      kind: "background",
      label: "Background",
    });
    expect(result.current.historySelectors).toMatchObject({
      canUndo: true,
      canRedo: false,
    });

    act(() => result.current.handleUndoDocument());
    expect(result.current.singleDocument?.history.future).toHaveLength(1);
    expect(result.current.state.status).toBe("result");
    if (result.current.state.status === "result")
      expect(result.current.state.result.backgroundFill).toEqual({
        type: "transparent",
      });

    act(() => result.current.handleRedoDocument());
    expect(result.current.singleDocument?.history.past).toHaveLength(1);
    if (result.current.state.status === "result")
      expect(result.current.state.result.backgroundFill).toEqual({
        type: "color",
        value: "#ffffff",
      });

    act(() => result.current.handleReset());
    expect(result.current.singleDocument).toBeNull();
    expect(scope.artifacts.stats().artifactCount).toBe(0);
  });

  it("releases the previous source document before starting replacement work", async () => {
    const { result } = renderHook(() => useToolWorkspaceController());
    await completeAutomaticRun(result, source("first"));
    const previous = result.current.singleDocument;
    if (!previous) throw new Error("Expected a completed edit document");

    act(() => result.current.handleUpload({ ok: true, image: source("replacement") }));

    expect(result.current.singleDocument).toBeNull();
    expect(previous.artifacts.stats().artifactCount).toBe(0);
  });
});
