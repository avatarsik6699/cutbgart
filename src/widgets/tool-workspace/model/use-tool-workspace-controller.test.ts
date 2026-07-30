import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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
): Promise<MockWorker> {
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
  return worker;
}

async function settleLatestDispose(worker: MockWorker): Promise<void> {
  await waitFor(() =>
    expect(worker.posted.some((message) => message.type === "dispose")).toBe(true),
  );
  const request = worker.posted.filter((message) => message.type === "dispose").at(-1);
  act(() => worker.emit({ type: "disposed", requestId: request?.requestId }));
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
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("aborts a multi-file batch upload entirely when one file is invalid (PHASE_31 T8/F7)", () => {
    const { result } = renderHook(() => useToolWorkspaceController());

    act(() =>
      result.current.handleUploads([
        { fileName: "a.jpg", result: { ok: true, image: source("a") } },
        {
          fileName: "b.gif",
          result: {
            ok: false,
            error: {
              code: "unsupported-format",
              message: 'Unsupported format "image/gif"',
            },
          },
        },
        { fileName: "c.jpg", result: { ok: true, image: source("c") } },
      ]),
    );

    expect(result.current.uploadError).toMatchObject({ code: "unsupported-format" });
    // No file from the batch is enqueued — the whole attempt aborts rather
    // than silently dropping the invalid file and processing the rest.
    expect(result.current.batch.session.items).toHaveLength(0);

    act(() => result.current.handleDismissUploadError());
    expect(result.current.uploadError).toBeNull();
  });

  it("releases the previous source document before starting replacement work", async () => {
    const { result, unmount } = renderHook(() => useToolWorkspaceController());
    await completeAutomaticRun(result, source("first"));
    const previous = result.current.singleDocument;
    if (!previous) throw new Error("Expected a completed edit document");

    act(() => result.current.handleUpload({ ok: true, image: source("replacement") }));
    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(previous.artifacts.stats().artifactCount).toBe(0);
    expect(MockWorker.instances.every((worker) => worker.terminated)).toBe(true);
  });

  it("serializes both enhancement stages into one atomic history entry", async () => {
    const { result } = renderHook(() => useToolWorkspaceController());
    const automaticWorker = await completeAutomaticRun(result, source("enhance"));
    if (result.current.state.status !== "result")
      throw new Error("Expected a completed automatic result");

    act(() =>
      result.current.applySingleEnhancements(
        result.current.state.status === "result"
          ? result.current.state.result
          : (null as never),
        ["fine-detail", "colour-halo"],
        "Enhancements",
      ),
    );
    await settleLatestDispose(automaticWorker);

    await waitFor(() =>
      expect(
        MockWorker.instances.some((worker) =>
          worker.posted.some((message) => message.type === "refine"),
        ),
      ).toBe(true),
    );
    const matteWorker = MockWorker.instances.find((worker) =>
      worker.posted.some((message) => message.type === "refine"),
    )!;
    const matteRequest = matteWorker.posted.find((message) => message.type === "refine")
      ?.request as
      | {
          requestId: string;
          priorMatte: {
            width: number;
            height: number;
            data: Uint8ClampedArray;
          };
          requestedMode: string;
          requestedPath: string;
          inputSize: { width: number; height: number };
        }
      | undefined;
    if (!matteRequest) throw new Error("Expected a matte request");
    act(() =>
      matteWorker.emit({
        type: "result",
        requestId: matteRequest.requestId,
        result: {
          matte: {
            ...matteRequest.priorMatte,
            data: matteRequest.priorMatte.data.slice(),
          },
          requestedMode: matteRequest.requestedMode,
          actualMode: matteRequest.requestedMode,
          actualPath: matteRequest.requestedPath,
          inputSize: matteRequest.inputSize,
          fallback: "none",
        },
      }),
    );
    await settleLatestDispose(matteWorker);

    await waitFor(() =>
      expect(
        MockWorker.instances.some((worker) =>
          worker.posted.some((message) => message.type === "refine-foreground"),
        ),
      ).toBe(true),
    );
    const foregroundWorker = MockWorker.instances.find((worker) =>
      worker.posted.some((message) => message.type === "refine-foreground"),
    )!;
    const foregroundRequest = foregroundWorker.posted.find(
      (message) => message.type === "refine-foreground",
    )?.request as
      | {
          requestId: string;
          source: SourceImage;
          matte: {
            width: number;
            height: number;
            data: Uint8ClampedArray;
          };
        }
      | undefined;
    if (!foregroundRequest) throw new Error("Expected a foreground request");
    act(() =>
      foregroundWorker.emit({
        type: "result",
        requestId: foregroundRequest.requestId,
        result: {
          foreground: foregroundRequest.source.blob,
          matte: foregroundRequest.matte,
          dirtyPatch: null,
          requestedPath: "decontaminate",
          actualPath: "decontaminate",
          fallback: "none",
          durationMs: 1,
          memoryBytes: "unavailable",
        },
      }),
    );

    await waitFor(() =>
      expect(
        automaticWorker.posted.some((message) => message.type === "recomposite"),
      ).toBe(true),
    );
    const recompositeRequest = automaticWorker.posted.find(
      (message) => message.type === "recomposite",
    );
    const previous =
      result.current.state.status === "result" ? result.current.state.result : null;
    if (!previous) throw new Error("Expected current result before recomposition");
    act(() =>
      automaticWorker.emit({
        type: "recomposite-result",
        requestId: recompositeRequest?.requestId,
        result: {
          ...previous,
          result: new Blob(["enhanced"]),
          foreground: foregroundRequest.source.blob,
          alphaMatte: foregroundRequest.matte,
        },
        durationMs: 1,
      }),
    );

    await waitFor(() =>
      expect(result.current.singleDocument?.history.past).toHaveLength(1),
    );
    expect(result.current.singleDocument?.history.past[0]).toMatchObject({
      kind: "enhance",
      label: "Enhancements",
    });
    expect(result.current.enhancementState.outcome).toBe("applied");
    expect(
      MockWorker.instances
        .flatMap((worker) => worker.posted)
        .filter((message) => ["refine", "refine-foreground"].includes(message.type))
        .map((message) => message.type),
    ).toEqual(["refine", "refine-foreground"]);
  });

  it("creates no history for unchanged or cancelled enhancement work", async () => {
    const { result } = renderHook(() => useToolWorkspaceController());
    const automaticWorker = await completeAutomaticRun(result, source("unchanged"));
    if (result.current.state.status !== "result")
      throw new Error("Expected a completed automatic result");
    const image = result.current.state.result;

    act(() =>
      result.current.applySingleEnhancements(image, ["fine-detail"], "Enhancements"),
    );
    await settleLatestDispose(automaticWorker);
    await waitFor(() =>
      expect(
        MockWorker.instances.some((worker) =>
          worker.posted.some((message) => message.type === "refine"),
        ),
      ).toBe(true),
    );
    const matteWorker = MockWorker.instances.find((worker) =>
      worker.posted.some((message) => message.type === "refine"),
    )!;
    const request = matteWorker.posted.find((message) => message.type === "refine")
      ?.request as {
      requestId: string;
      priorMatte: {
        width: number;
        height: number;
        data: Uint8ClampedArray;
      };
      requestedMode: string;
      requestedPath: string;
      inputSize: { width: number; height: number };
    };
    act(() =>
      matteWorker.emit({
        type: "result",
        requestId: request.requestId,
        result: {
          matte: { ...request.priorMatte, data: request.priorMatte.data.slice() },
          requestedMode: request.requestedMode,
          actualMode: request.requestedMode,
          actualPath: request.requestedPath,
          inputSize: request.inputSize,
          fallback: "none",
        },
      }),
    );
    await waitFor(() =>
      expect(result.current.enhancementState.outcome).toBe("unchanged"),
    );
    expect(result.current.singleDocument?.history.past).toHaveLength(0);

    act(() =>
      result.current.applySingleEnhancements(image, ["colour-halo"], "Enhancements"),
    );
    await Promise.all([
      settleLatestDispose(automaticWorker),
      settleLatestDispose(matteWorker),
    ]);
    await waitFor(() =>
      expect(
        MockWorker.instances.some((worker) =>
          worker.posted.some((message) => message.type === "refine-foreground"),
        ),
      ).toBe(true),
    );
    const foregroundWorker = MockWorker.instances.find((worker) =>
      worker.posted.some((message) => message.type === "refine-foreground"),
    )!;
    const foregroundRequest = foregroundWorker.posted.find(
      (message) => message.type === "refine-foreground",
    )?.request as { requestId: string; matte: unknown; source: SourceImage };
    act(() => result.current.cancelEnhancements());
    act(() =>
      foregroundWorker.emit({
        type: "result",
        requestId: foregroundRequest.requestId,
        result: {
          foreground: foregroundRequest.source.blob,
          matte: foregroundRequest.matte,
          actualPath: "decontaminate",
          fallback: "none",
        },
      }),
    );
    expect(result.current.singleDocument?.history.past).toHaveLength(0);
    expect(result.current.enhancementState.outcome).toBe("kept-current");
  });
});
