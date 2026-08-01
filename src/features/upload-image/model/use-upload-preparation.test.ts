import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUploadPreparation } from "./use-upload-preparation";

class MockPreparationWorker extends EventTarget {
  readonly posted: Array<{ requestId: string; file: File }> = [];
  readonly terminate = vi.fn();

  postMessage(message: { requestId: string; file: File }): void {
    this.posted.push(message);
  }

  finish(requestId: string): void {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "prepared",
          requestId,
          result: {
            ok: true,
            image: {
              blob: new Blob(),
              width: 1,
              height: 1,
              format: "image/jpeg",
            },
          },
        },
      }),
    );
  }

  crash(): void {
    this.dispatchEvent(new ErrorEvent("error", { message: "decode worker crashed" }));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUploadPreparation", () => {
  it("owns one worker and resolves each file by request id", async () => {
    const worker = new MockPreparationWorker();
    const factory = vi.fn(() => worker as unknown as Worker);
    vi.stubGlobal("Worker", class WorkerStub {});
    const hook = renderHook(() => useUploadPreparation(factory));
    const first = new File(["a"], "first.jpg", { type: "image/jpeg" });
    const second = new File(["b"], "second.jpg", { type: "image/jpeg" });

    const pending = hook.result.current.prepareFiles([first, second]);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(worker.posted).toHaveLength(2);
    act(() => {
      worker.finish(worker.posted[0]!.requestId);
      worker.finish(worker.posted[1]!.requestId);
    });

    await expect(pending).resolves.toMatchObject([
      { fileName: "first.jpg", result: { ok: true } },
      { fileName: "second.jpg", result: { ok: true } },
    ]);
    hook.unmount();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("settles every pending file when the worker crashes", async () => {
    const worker = new MockPreparationWorker();
    vi.stubGlobal("Worker", class WorkerStub {});
    const hook = renderHook(() =>
      useUploadPreparation(() => worker as unknown as Worker),
    );
    const pending = hook.result.current.prepareFiles([
      new File(["a"], "first.jpg", { type: "image/jpeg" }),
      new File(["b"], "second.jpg", { type: "image/jpeg" }),
    ]);

    act(() => worker.crash());

    const results = await pending;
    expect(results.map((item) => item.result.ok)).toEqual([false, false]);
    hook.unmount();
  });
});
