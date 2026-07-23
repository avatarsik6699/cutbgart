import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGuidedBrushSelection, useObjectSelection } from "./use-object-selection";

class FakeWorker extends EventTarget {
  posted: unknown[] = [];
  terminated = false;
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

const source = {
  blob: new Blob(["x"], { type: "image/jpeg" }),
  width: 10,
  height: 5,
  format: "image/jpeg" as const,
};

function matte(value: number) {
  return { width: 10, height: 5, data: new Uint8ClampedArray(50).fill(value) };
}

describe("useObjectSelection", () => {
  it("encodes lazily, sends cumulative labels, and releases the worker", async () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useObjectSelection(() => worker as unknown as Worker),
    );
    act(() => result.current.start(source));
    const encode = worker.posted[0] as { revision: number };
    expect(encode).toMatchObject({ type: "encode", source });
    act(() =>
      worker.emit({
        type: "status",
        revision: encode.revision,
        status: "ready-for-prompt",
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready-for-prompt"));

    act(() => result.current.addPoint(0.25, 0.5, 1));
    act(() => result.current.addPoint(0.75, 0.5, 0));
    const prompts = worker.posted.filter(
      (item) => (item as { type: string }).type === "prompt",
    ) as Array<{ prompt: { revision: number; points: Array<{ label: number }> } }>;
    expect(prompts).toHaveLength(2);
    expect(prompts[1]!.prompt.points.map((point) => point.label)).toEqual([1, 0]);

    const revision = prompts[1]!.prompt.revision;
    act(() =>
      worker.emit({
        type: "candidates",
        revision,
        candidates: [
          { id: "best", matte: matte(255), score: 0.9, differenceRatio: 0 },
          { id: "other", matte: matte(128), score: 0.5, differenceRatio: 1 },
        ],
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("preview"));
    expect(result.current.state.session?.layers[0]?.selectedCandidateId).toBe("best");
    act(() => result.current.selectCandidate("other"));
    expect(result.current.state.matte?.data[0]).toBe(128);
    act(() => result.current.addPoint(0.5, 0.5, 1));
    expect(
      (
        worker.posted.at(-1) as {
          prompt: { previousMask: { data: Uint8ClampedArray } | null };
        }
      ).prompt.previousMask?.data[0],
    ).toBe(128);
    let released = false;
    let releasePromise!: Promise<void>;
    act(() => {
      releasePromise = result.current.release().then(() => {
        released = true;
      });
    });
    const dispose = worker.posted.at(-1) as { revision: number };
    expect(dispose).toMatchObject({ type: "dispose" });
    expect(released).toBe(false);
    act(() => worker.emit({ type: "disposed", revision: dispose.revision }));
    await releasePromise;
    expect(released).toBe(true);
    act(() => result.current.reset());
    expect(worker.terminated).toBe(true);
  });

  it("rejects stale candidate revisions and recreates a crashed worker on retry", async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    const workers = [first, second];
    const { result } = renderHook(() =>
      useObjectSelection(() => workers.shift() as unknown as Worker),
    );
    act(() => result.current.start(source));
    const encodeRevision = (first.posted[0] as { revision: number }).revision;
    act(() =>
      first.emit({
        type: "status",
        revision: encodeRevision,
        status: "ready-for-prompt",
      }),
    );
    act(() => result.current.addPoint(0.2, 0.2, 1));
    const staleRevision = (first.posted.at(-1) as { prompt: { revision: number } }).prompt
      .revision;
    act(() => result.current.addPoint(0.8, 0.8, 1));
    const latestRevision = (first.posted.at(-1) as { prompt: { revision: number } })
      .prompt.revision;
    act(() =>
      first.emit({
        type: "candidates",
        revision: staleRevision,
        candidates: [{ id: "stale", matte: matte(1), score: 1, differenceRatio: 0 }],
      }),
    );
    expect(result.current.state.status).toBe("predicting-mask");
    act(() =>
      first.emit({
        type: "candidates",
        revision: latestRevision,
        candidates: [{ id: "latest", matte: matte(2), score: 1, differenceRatio: 0 }],
      }),
    );
    await waitFor(() =>
      expect(result.current.state.session?.layers[0]?.selectedCandidateId).toBe("latest"),
    );

    act(() => {
      first.dispatchEvent(new ErrorEvent("error", { message: "worker crashed" }));
    });
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    act(() => result.current.retry());
    expect(second.posted[0]).toMatchObject({ type: "encode", source });
  });
});

describe("useGuidedBrushSelection", () => {
  it("keeps painting/history inference-free and enforces direct green validation", async () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useGuidedBrushSelection(() => worker as unknown as Worker),
    );
    act(() => result.current.start(source));
    const revision = (worker.posted[0] as { revision: number }).revision;
    act(() => worker.emit({ type: "status", revision, status: "ready-for-prompt" }));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    act(() =>
      result.current.addStroke({
        mode: "remove",
        points: [{ x: 0.5, y: 0.5 }],
        radius: 2,
      }),
    );
    act(() => result.current.setBrushRadius(4));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(
      worker.posted.filter((message) => (message as { type: string }).type === "prompt"),
    ).toHaveLength(0);
    act(() => result.current.recompute());
    expect(result.current.state.errorCode).toBe("keep-required");
    expect(
      worker.posted.filter((message) => (message as { type: string }).type === "prompt"),
    ).toHaveLength(0);
  });

  it("sends one bounded balanced prompt set only on explicit recompute", () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useGuidedBrushSelection(() => worker as unknown as Worker),
    );
    act(() => result.current.start(source, matte(80)));
    const encodeRevision = (worker.posted[0] as { revision: number }).revision;
    act(() =>
      worker.emit({
        type: "status",
        revision: encodeRevision,
        status: "ready-for-prompt",
      }),
    );
    for (let index = 0; index < 20; index += 1) {
      act(() =>
        result.current.addStroke({
          mode: index % 2 ? "remove" : "keep",
          points: [
            { x: index / 20, y: 0 },
            { x: index / 20, y: 1 },
          ],
          radius: 1,
        }),
      );
    }
    expect(result.current.state.status).toBe("dirty");
    act(() => result.current.recompute());
    const prompt = worker.posted.at(-1) as {
      type: string;
      prompt: { revision: number; points: Array<{ label: number }> };
    };
    expect(prompt.type).toBe("prompt");
    expect(prompt.prompt.points.length).toBeLessThanOrEqual(32);
    expect(prompt.prompt.points.filter((point) => point.label === 1)).toHaveLength(16);
    expect(prompt.prompt.points.filter((point) => point.label === 0)).toHaveLength(16);
  });

  it("rejects stale results, ranks intent first, and preserves the prior result on error", async () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useGuidedBrushSelection(() => worker as unknown as Worker),
    );
    act(() => result.current.start(source, matte(33)));
    const encodeRevision = (worker.posted[0] as { revision: number }).revision;
    act(() =>
      worker.emit({
        type: "status",
        revision: encodeRevision,
        status: "ready-for-prompt",
      }),
    );
    act(() =>
      result.current.addStroke({
        mode: "keep",
        points: [{ x: 0.5, y: 0.5 }],
        radius: 1,
      }),
    );
    act(() => result.current.recompute());
    const staleRevision = (worker.posted.at(-1) as { prompt: { revision: number } })
      .prompt.revision;
    act(() =>
      result.current.addStroke({
        mode: "keep",
        points: [{ x: 0.2, y: 0.2 }],
        radius: 1,
      }),
    );
    act(() =>
      worker.emit({
        type: "candidates",
        revision: staleRevision,
        candidates: [{ id: "stale", matte: matte(255), score: 9, differenceRatio: 0 }],
      }),
    );
    expect(result.current.state.status).toBe("dirty");
    act(() => result.current.recompute());
    const currentRevision = (worker.posted.at(-1) as { prompt: { revision: number } })
      .prompt.revision;
    act(() =>
      worker.emit({
        type: "candidates",
        revision: currentRevision,
        candidates: [
          { id: "raw-first", matte: matte(0), score: 999, differenceRatio: 0 },
          { id: "intent-first", matte: matte(255), score: -5, differenceRatio: 0 },
        ],
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("preview"));
    expect(result.current.state.session?.selectedCandidateId).toBe("intent-first");
    expect(result.current.canAccept).toBe(true);
    const accepted = result.current.state.matte;
    act(() =>
      result.current.addStroke({
        mode: "remove",
        points: [{ x: 0.9, y: 0.9 }],
        radius: 1,
      }),
    );
    act(() => result.current.recompute());
    const failedRevision = (worker.posted.at(-1) as { prompt: { revision: number } })
      .prompt.revision;
    act(() =>
      worker.emit({
        type: "error",
        revision: failedRevision,
        message: "recoverable",
      }),
    );
    expect(result.current.state.matte).toBe(accepted);
    expect(result.current.state.session?.strokes).toHaveLength(3);
    expect(result.current.canAccept).toBe(false);
  });

  it("recreates the worker after unreadable or malformed candidate responses", () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    const third = new FakeWorker();
    const workers = [first, second, third];
    const { result } = renderHook(() =>
      useGuidedBrushSelection(() => workers.shift() as unknown as Worker),
    );

    act(() => result.current.start(source, matte(40)));
    act(() => {
      first.dispatchEvent(new MessageEvent("messageerror"));
    });
    expect(first.terminated).toBe(true);
    expect(result.current.state.status).toBe("error");

    act(() => result.current.retry());
    const encodeRevision = (second.posted[0] as { revision: number }).revision;
    act(() =>
      second.emit({
        type: "status",
        revision: encodeRevision,
        status: "ready-for-prompt",
      }),
    );
    act(() =>
      result.current.addStroke({
        mode: "keep",
        points: [{ x: 0.5, y: 0.5 }],
        radius: 2,
      }),
    );
    act(() => result.current.recompute());
    const promptRevision = (second.posted.at(-1) as { prompt: { revision: number } })
      .prompt.revision;
    act(() =>
      second.emit({
        type: "candidates",
        revision: promptRevision,
        candidates: [
          {
            id: "wrong-size",
            matte: { width: 1, height: 1, data: new Uint8ClampedArray([255]) },
            score: 1,
            differenceRatio: 0,
          },
        ],
      }),
    );
    expect(second.terminated).toBe(true);
    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toMatch(/dimensions/i);

    act(() => result.current.retry());
    expect(third.posted[0]).toMatchObject({ type: "encode", source });
  });

  it("promotes the chosen result to a clean base without rerunning the model", async () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useGuidedBrushSelection(() => worker as unknown as Worker),
    );
    act(() => result.current.start(source, matte(33)));
    const encodeRevision = (worker.posted[0] as { revision: number }).revision;
    act(() =>
      worker.emit({
        type: "status",
        revision: encodeRevision,
        status: "ready-for-prompt",
      }),
    );
    act(() =>
      result.current.addStroke({
        mode: "remove",
        points: [{ x: 0.5, y: 0.5 }],
        radius: 1,
      }),
    );
    act(() => result.current.recompute());
    const computedRevision = (worker.posted.at(-1) as { prompt: { revision: number } })
      .prompt.revision;
    act(() =>
      worker.emit({
        type: "candidates",
        revision: computedRevision,
        candidates: [{ id: "chosen", matte: matte(200), score: 1, differenceRatio: 0 }],
      }),
    );
    await waitFor(() => expect(result.current.canAccept).toBe(true));
    const promptCount = worker.posted.filter(
      (message) => (message as { type: string }).type === "prompt",
    ).length;

    act(() => result.current.continueFromResult());

    expect(result.current.state.session).toMatchObject({
      baseMatte: result.current.state.matte,
      strokes: [],
      candidates: [],
      selectedCandidateId: null,
      history: [],
      redo: [],
      status: "preview",
    });
    expect(result.current.canAccept).toBe(true);
    expect(
      worker.posted.filter((message) => (message as { type: string }).type === "prompt"),
    ).toHaveLength(promptCount);
  });

  it("disposes and terminates the worker on release", async () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useGuidedBrushSelection(() => worker as unknown as Worker),
    );
    act(() => result.current.start(source));
    let release!: Promise<void>;
    let duplicateRelease!: Promise<void>;
    act(() => {
      release = result.current.release();
      duplicateRelease = result.current.release();
    });
    expect(duplicateRelease).toBe(release);
    expect(
      worker.posted.filter((message) => (message as { type: string }).type === "dispose"),
    ).toHaveLength(1);
    const dispose = worker.posted.at(-1) as { revision: number };
    act(() => worker.emit({ type: "disposed", revision: dispose.revision }));
    await release;
    expect(worker.terminated).toBe(true);
  });

  it("bounds disposal wait when a worker never acknowledges it", async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const { result } = renderHook(() =>
        useGuidedBrushSelection(() => worker as unknown as Worker),
      );
      act(() => result.current.start(source));
      let release!: Promise<void>;
      act(() => {
        release = result.current.release();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
        await release;
      });
      expect(worker.terminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
