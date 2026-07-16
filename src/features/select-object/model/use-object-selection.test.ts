import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useObjectSelection } from "./use-object-selection";

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
