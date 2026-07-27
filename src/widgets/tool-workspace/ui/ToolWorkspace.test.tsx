import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToolWorkspace } from "./ToolWorkspace";

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

  postMessage(message: PostedMessage): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function makeFile(overrides: { type?: string; size?: number } = {}): File {
  const size = overrides.size ?? 1024;
  const bytes = new Uint8Array(size);
  bytes.set([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x11,
    0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  return new File([bytes], "photo.jpg", {
    type: overrides.type ?? "image/jpeg",
  });
}

async function completeAutomaticWorkspace(): Promise<MockWorker> {
  fireEvent.change(screen.getByLabelText("Upload an image"), {
    target: { files: [makeFile()] },
  });
  await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
  const worker = MockWorker.instances[0]!;
  await waitFor(() =>
    expect(worker.posted.some((message) => message.type === "load-model")).toBe(true),
  );
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
      result: new Blob(["automatic"], { type: "image/png" }),
      matte: {
        width: 800,
        height: 600,
        data: new Uint8ClampedArray(800 * 600).fill(255),
      },
      durationMs: 1,
    }),
  );
  await waitFor(() => expect(screen.getByTestId("editor-toolbar")).toBeDefined());
  return worker;
}

async function enterDirectGuidedPreview(): Promise<MockWorker> {
  fireEvent.change(screen.getByLabelText("Upload an image"), {
    target: { files: [makeFile()] },
  });
  await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
  const automaticWorker = MockWorker.instances[0]!;
  await waitFor(() =>
    expect(automaticWorker.posted.some((message) => message.type === "load-model")).toBe(
      true,
    ),
  );
  act(() =>
    automaticWorker.emit({
      type: "model-ready",
      qualityMode: "isnet-q8",
      inferencePath: "wasm",
      dtype: "q8",
    }),
  );
  await waitFor(() =>
    expect(automaticWorker.posted.some((message) => message.type === "process")).toBe(
      true,
    ),
  );
  const process = automaticWorker.posted.find((message) => message.type === "process");
  act(() =>
    automaticWorker.emit({
      type: "process-result",
      requestId: process?.requestId,
      result: new Blob(["automatic"], { type: "image/png" }),
      matte: {
        width: 800,
        height: 600,
        data: new Uint8ClampedArray(800 * 600).fill(255),
      },
      durationMs: 1,
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /refine selection with brush/i }),
  );
  await waitFor(() =>
    expect(automaticWorker.posted.some((message) => message.type === "dispose")).toBe(
      true,
    ),
  );
  const dispose = automaticWorker.posted.find((message) => message.type === "dispose");
  act(() =>
    automaticWorker.emit({
      type: "disposed",
      requestId: dispose?.requestId,
    }),
  );
  await waitFor(() => expect(MockWorker.instances).toHaveLength(2));
  const worker = MockWorker.instances[1]!;
  const encode = worker.posted.find((message) => message.type === "encode");
  act(() =>
    worker.emit({
      type: "status",
      revision: encode?.revision,
      status: "ready-for-prompt",
    }),
  );
  const image = await screen.findByRole("img", {
    name: /brush-guided object correction/i,
  });
  Object.defineProperty(image, "setPointerCapture", { value: vi.fn() });
  fireEvent.pointerDown(image, {
    pointerId: 1,
    button: 0,
    isPrimary: true,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerUp(image, { pointerId: 1, clientX: 20, clientY: 20 });
  fireEvent.click(screen.getByRole("button", { name: /recompute mask/i }));
  const prompt = worker.posted.find((message) => message.type === "prompt") as
    { prompt?: { revision: number } } | undefined;
  act(() =>
    worker.emit({
      type: "candidates",
      revision: prompt?.prompt?.revision,
      candidates: [
        {
          id: "intent",
          matte: {
            width: 800,
            height: 600,
            data: new Uint8ClampedArray(800 * 600).fill(255),
          },
          score: 1,
          differenceRatio: 0,
        },
      ],
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /accept and refine/i })
        .disabled,
    ).toBe(false),
  );
  return worker;
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

describe("ToolWorkspace", () => {
  it("renders the idle state with the upload controls", () => {
    render(<ToolWorkspace />);

    expect(screen.getByTestId("tool-workspace")).toBeDefined();
    expect(screen.getByLabelText("Upload an image")).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("shows a validation error for an unsupported file without starting the model pipeline", async () => {
    render(<ToolWorkspace />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile({ type: "image/gif" })] },
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/unsupported/i);
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("starts automatic processing from the single upload surface", async () => {
    render(<ToolWorkspace />);
    expect(screen.queryByRole("button", { name: /guide with a brush/i })).toBeNull();
    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile()] },
    });
    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((message) => message.type === "load-model")).toBe(true),
    );
    expect(worker.posted.some((message) => message.type === "encode")).toBe(false);
  });

  it("locks guided interaction while applying and exposes a retryable apply error", async () => {
    render(<ToolWorkspace />);
    await enterDirectGuidedPreview();

    fireEvent.click(screen.getByRole("button", { name: /accept and refine/i }));
    await waitFor(() => expect(MockWorker.instances.length).toBeGreaterThan(1));
    const compositeWorker = MockWorker.instances[0]!;
    const firstRequest = compositeWorker.posted.find(
      (message) => message.type === "recomposite",
    );
    expect(firstRequest).toBeDefined();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /accept and refine/i })
        .disabled,
    ).toBe(true);
    expect(
      screen
        .getAllByRole("status")
        .some((status) => /applying.*result/i.test(status.textContent ?? "")),
    ).toBe(true);

    act(() =>
      compositeWorker.emit({
        type: "error",
        requestId: firstRequest?.requestId,
        code: "compositing-failed",
        message: "Mock recomposite failed",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/mock recomposite failed/i),
    );
    expect(screen.getByTestId("guided-brush-selection")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() =>
      expect(
        compositeWorker.posted.filter((message) => message.type === "recomposite"),
      ).toHaveLength(2),
    );
  });

  it("does not reopen guided correction when matte extraction finishes after reset", async () => {
    render(<ToolWorkspace />);
    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile()] },
    });
    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((message) => message.type === "load-model")).toBe(true),
    );
    act(() => worker.emit({ type: "model-ready", qualityMode: "fast" }));
    await waitFor(() =>
      expect(worker.posted.some((message) => message.type === "process")).toBe(true),
    );
    const processRequest = worker.posted.find((message) => message.type === "process");
    act(() =>
      worker.emit({
        type: "process-result",
        requestId: processRequest?.requestId,
        result: new Blob(["fake-png"], { type: "image/png" }),
      }),
    );
    const guide = await screen.findByRole("button", {
      name: /refine selection with brush/i,
    });
    fireEvent.click(guide);
    await waitFor(() =>
      expect(
        worker.posted.some((message) => message.type === "extract-alpha-matte"),
      ).toBe(true),
    );
    const extractRequest = worker.posted.find(
      (message) => message.type === "extract-alpha-matte",
    );

    fireEvent.click(screen.getByRole("button", { name: /process another image/i }));
    act(() =>
      worker.emit({
        type: "alpha-matte-result",
        requestId: extractRequest?.requestId,
        matte: {
          width: 800,
          height: 600,
          data: new Uint8ClampedArray(800 * 600).fill(255),
        },
        durationMs: 1,
      }),
    );

    await waitFor(() => expect(screen.getByLabelText("Upload an image")).toBeDefined());
    expect(screen.queryByTestId("guided-brush-selection")).toBeNull();
  });

  it("drives upload -> process -> result -> reset without a page reload", async () => {
    render(<ToolWorkspace />);

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
        matte: {
          width: 800,
          height: 600,
          data: new Uint8ClampedArray(800 * 600).fill(255),
        },
      });
    });

    await waitFor(() => expect(screen.getByRole("slider")).toBeDefined());
    expect(screen.getByRole("button", { name: /download/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /reprocess in optimal/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /process another image/i }));

    await waitFor(() => expect(screen.getByLabelText("Upload an image")).toBeDefined());
  });

  it("switches registry tools without remounting the stage or resetting document view", async () => {
    render(<ToolWorkspace />);
    await completeAutomaticWorkspace();
    const stage = screen.getByTestId("editor-stage");
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("55");

    fireEvent.click(screen.getByRole("button", { name: /^Enhancements$/ }));
    expect(screen.getByTestId("editor-stage")).toBe(stage);
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("55");
    expect(screen.getByTestId("tool-panel-slot").getAttribute("data-active-tool")).toBe(
      "enhance",
    );

    fireEvent.click(screen.getByRole("button", { name: /^Background$/ }));
    expect(screen.getByTestId("editor-stage")).toBe(stage);
    expect(screen.getByTestId("tool-panel-slot").getAttribute("data-active-tool")).toBe(
      "background",
    );
    expect(screen.getByTestId("tool-workspace").textContent).not.toMatch(
      /IS-Net|BEN2|WebGPU|WASM|MiB|dtype/i,
    );
  });

  it("guards an unsaved background draft before switching tools", async () => {
    render(<ToolWorkspace />);
    await completeAutomaticWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /^Background$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));

    fireEvent.click(screen.getByRole("button", { name: /^Cutout$/ }));

    expect(screen.getByTestId("editor-draft-guard")).toBeDefined();
    expect(screen.getByTestId("tool-panel-slot").getAttribute("data-active-tool")).toBe(
      "background",
    );
    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    await waitFor(() =>
      expect(screen.getByTestId("tool-panel-slot").getAttribute("data-active-tool")).toBe(
        "cutout",
      ),
    );
  });

  it("edit mask -> correcting -> done returns to result with the corrected composite (Phase 07)", async () => {
    render(<ToolWorkspace />);

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
        matte: {
          width: 800,
          height: 600,
          data: new Uint8ClampedArray(800 * 600).fill(255),
        },
      });
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit mask/i })).toBeDefined(),
    );

    fireEvent.click(screen.getByRole("button", { name: /edit mask/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^done$/i })).toBeDefined(),
    );
    expect(screen.getByRole("img", { name: /mask correction canvas/i })).toBeDefined();
    expect(screen.getByRole("group", { name: /brush mode/i })).toBeDefined();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/mask editor zoom 100%/i),
    );

    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/mask editor zoom 125%/i),
    );

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
    render(<ToolWorkspace />);

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
