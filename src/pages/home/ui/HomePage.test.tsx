import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "./HomePage";

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

// jsdom doesn't implement `ImageData` — MaskCorrectionCanvas's paint path
// constructs one directly (see MaskCorrectionCanvas.test.tsx for the same
// stub).
class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal("ImageData", FakeImageData);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }),
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(800 * 600 * 4) }),
    putImageData: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  cleanup();
});

describe("HomePage", () => {
  it("renders the idle state with the upload controls", () => {
    render(<HomePage />);

    expect(screen.getByTestId("home-page")).toBeDefined();
    expect(screen.getByLabelText("Upload an image")).toBeDefined();
    expect(screen.getByRole("switch")).toBeDefined();
  });

  it("shows a validation error for an unsupported file without starting the model pipeline", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile({ type: "image/gif" })] },
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/unsupported/i);
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("drives upload -> process -> result -> reset without a page reload", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile()] },
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );

    act(() => {
      worker.emit({ type: "model-ready", qualityMode: "fast" });
    });

    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "process")).toBe(true),
    );
    const processRequest = worker.posted.find((m) => m.type === "process");
    const resultBlob = new Blob(["fake-png"], { type: "image/png" });

    act(() => {
      worker.emit({
        type: "process-result",
        requestId: processRequest?.requestId,
        result: resultBlob,
      });
    });

    await waitFor(() => expect(screen.getByRole("slider")).toBeDefined());
    expect(screen.getByRole("button", { name: /download/i })).toBeDefined();
    expect(
      screen.getByRole("button", { name: /recompute in max quality/i }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /process another image/i }));

    await waitFor(() => expect(screen.getByLabelText("Upload an image")).toBeDefined());
  });

  it("edit mask -> correcting -> done returns to result with the corrected composite (Phase 07)", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile()] },
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );
    act(() => {
      worker.emit({ type: "model-ready", qualityMode: "fast" });
    });
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "process")).toBe(true),
    );
    const processRequest = worker.posted.find((m) => m.type === "process");
    act(() => {
      worker.emit({
        type: "process-result",
        requestId: processRequest?.requestId,
        result: new Blob(["fake-png"], { type: "image/png" }),
      });
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit mask/i })).toBeDefined(),
    );

    fireEvent.click(screen.getByRole("button", { name: /edit mask/i }));
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "extract-alpha-matte")).toBe(true),
    );
    const extractRequest = worker.posted.find((m) => m.type === "extract-alpha-matte");
    act(() => {
      worker.emit({
        type: "alpha-matte-result",
        requestId: extractRequest?.requestId,
        matte: {
          width: 800,
          height: 600,
          data: new Uint8ClampedArray(800 * 600).fill(255),
        },
        durationMs: 4,
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^done$/i })).toBeDefined(),
    );
    expect(screen.getByRole("img", { name: /mask correction canvas/i })).toBeDefined();
    expect(screen.getByRole("group", { name: /brush mode/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "recomposite")).toBe(true),
    );
    const recompositeRequest = worker.posted.find((m) => m.type === "recomposite");
    act(() => {
      worker.emit({
        type: "recomposite-result",
        requestId: recompositeRequest?.requestId,
        result: {
          source: { blob: makeFile(), width: 800, height: 600, format: "image/jpeg" },
          result: new Blob(["corrected-png"], { type: "image/png" }),
          qualityMode: "fast",
        },
        durationMs: 5,
      });
    });

    await waitFor(() => expect(screen.getByRole("slider")).toBeDefined());
    expect(screen.getByRole("button", { name: /edit mask/i })).toBeDefined();
  });

  it("shows retry/reset UI when worker-backed mask preparation fails", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile()] },
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );
    act(() => {
      worker.emit({ type: "model-ready", qualityMode: "fast" });
    });
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "process")).toBe(true),
    );
    const processRequest = worker.posted.find((m) => m.type === "process");
    act(() => {
      worker.emit({
        type: "process-result",
        requestId: processRequest?.requestId,
        result: new Blob(["fake-png"], { type: "image/png" }),
      });
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit mask/i })).toBeDefined(),
    );

    fireEvent.click(screen.getByRole("button", { name: /edit mask/i }));
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "extract-alpha-matte")).toBe(true),
    );
    const extractRequest = worker.posted.find((m) => m.type === "extract-alpha-matte");
    act(() => {
      worker.emit({
        type: "error",
        code: "compositing-failed",
        requestId: extractRequest?.requestId,
        message: "OffscreenCanvas unavailable",
      });
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/could not prepare mask/i);
    expect(screen.getByRole("button", { name: /download/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /edit mask/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^reset$/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(worker.posted.filter((m) => m.type === "extract-alpha-matte")).toHaveLength(
        2,
      ),
    );
  });
});
