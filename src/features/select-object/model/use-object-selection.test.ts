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

describe("useObjectSelection", () => {
  it("creates the worker lazily, reuses one encoded image for prompts, and disposes on reset", async () => {
    const worker = new FakeWorker();
    let created = 0;
    const { result } = renderHook(() =>
      useObjectSelection(() => {
        created += 1;
        return worker as unknown as Worker;
      }),
    );
    expect(created).toBe(0);
    act(() => result.current.start(source));
    expect(created).toBe(1);
    expect(worker.posted).toEqual([{ type: "encode", source }]);
    act(() => worker.emit({ type: "status", status: "ready-for-prompt" }));
    await waitFor(() => expect(result.current.state.status).toBe("ready-for-prompt"));
    act(() => result.current.prompt({ type: "point", x: 0.5, y: 0.5, label: 1 }));
    expect(result.current.state.prompt).toEqual({
      type: "point",
      x: 0.5,
      y: 0.5,
      label: 1,
    });
    act(() =>
      worker.emit({
        type: "preview",
        matte: { width: 10, height: 5, data: new Uint8ClampedArray(50) },
      }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("preview"));
    act(() => result.current.replacePrompt());
    expect(result.current.state.status).toBe("ready-for-prompt");
    expect(result.current.state.prompt).toBeNull();
    expect(result.current.state.matte).toBeNull();
    act(() =>
      result.current.prompt({ type: "box", xMin: 0.1, yMin: 0.1, xMax: 0.9, yMax: 0.9 }),
    );
    expect(
      worker.posted.filter((message) => (message as { type: string }).type === "encode"),
    ).toHaveLength(1);
    expect(
      worker.posted.filter((message) => (message as { type: string }).type === "prompt"),
    ).toHaveLength(2);
    act(() => result.current.reset());
    expect(worker.terminated).toBe(true);
  });

  it("surfaces a worker crash and recreates the worker before retrying the image", async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    const workers = [first, second];
    const { result } = renderHook(() =>
      useObjectSelection(() => workers.shift() as unknown as Worker),
    );

    act(() => result.current.start(source));
    act(() => {
      first.dispatchEvent(
        new ErrorEvent("error", { message: "worker module could not be loaded" }),
      );
    });
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.error).toContain("worker module");
    expect(first.terminated).toBe(true);

    act(() => result.current.retry());
    expect(second.posted).toEqual([{ type: "encode", source }]);
  });
});
