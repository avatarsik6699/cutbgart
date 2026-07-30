import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderUtilityPortalProvider } from "@/shared/ui/header-utility-portal";
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

async function enterMagicDraft(): Promise<{
  automaticWorker: MockWorker;
  magicWorker: MockWorker;
}> {
  const automaticWorker = await completeAutomaticWorkspace();
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
  const magicWorker = MockWorker.instances[1]!;
  const encode = magicWorker.posted.find((message) => message.type === "encode");
  act(() =>
    magicWorker.emit({
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
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /^apply$/i }).disabled,
    ).toBe(false),
  );
  return { automaticWorker, magicWorker };
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

  it("keeps the diagnostics trigger in the stable header portal while idle", () => {
    const target = document.createElement("span");
    target.dataset.testid = "workspace-header-utilities";
    document.body.append(target);
    render(
      <HeaderUtilityPortalProvider target={target}>
        <ToolWorkspace />
      </HeaderUtilityPortalProvider>,
    );

    expect(screen.getByTestId("diagnostics-trigger-desktop")).toBeDefined();
    expect(target.contains(screen.getByTestId("diagnostics-trigger-desktop"))).toBe(true);
    target.remove();
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

  it("keeps the upload surface visible in place next to the error, with no layout shift (PHASE_31 T8/F7)", async () => {
    render(<ToolWorkspace />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile({ type: "image/gif" })] },
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    // The upload dropzone/quality toggle stay mounted — the error is shown
    // alongside them, not in place of them.
    expect(screen.getByLabelText("Upload an image")).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByLabelText("Upload an image")).toBeDefined();
  });

  it("aborts the whole batch when one of several files is invalid, instead of silently dropping it", async () => {
    render(<ToolWorkspace />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: {
        files: [makeFile({ type: "image/gif" }), makeFile(), makeFile()],
      },
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/unsupported/i);
    // None of the batch is enqueued — the whole attempt aborts predictably
    // rather than processing the valid files behind the error.
    expect(MockWorker.instances).toHaveLength(0);
    expect(screen.queryByTestId("batch-overview")).toBeNull();
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
    const { automaticWorker, magicWorker } = await enterMagicDraft();

    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    const prompt = magicWorker.posted.find((message) => message.type === "prompt") as
      { prompt?: { revision: number } } | undefined;
    act(() =>
      magicWorker.emit({
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
    const compositeWorker = automaticWorker;
    await waitFor(() =>
      expect(
        compositeWorker.posted.some((message) => message.type === "recomposite"),
      ).toBe(true),
    );
    const firstRequest = compositeWorker.posted.find(
      (message) => message.type === "recomposite",
    );
    expect(firstRequest).toBeDefined();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /applying/i }).disabled,
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
    expect(
      screen.getByTestId("guided-brush-selection").getAttribute("data-stroke-count"),
    ).toBe("1");
    const promptCount = magicWorker.posted.filter(
      (message) => message.type === "prompt",
    ).length;

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() =>
      expect(
        compositeWorker.posted.filter((message) => message.type === "recomposite"),
      ).toHaveLength(2),
    );
    expect(
      magicWorker.posted.filter((message) => message.type === "prompt"),
    ).toHaveLength(promptCount);
  });

  it("opens one automatic-result Cutout panel without separate correction entry points", async () => {
    render(<ToolWorkspace />);
    await completeAutomaticWorkspace();
    expect(screen.getByTestId("cutout-tool-panel")).toBeDefined();
    expect(screen.getByRole("tab", { name: "Magic" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Manual" })).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /refine selection with brush|edit mask/i }),
    ).toBeNull();
  });

  it("drives upload -> process -> unified result editor without a page reload", async () => {
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
    expect(screen.getByTestId("cutout-tool-panel")).toBeDefined();
    expect(screen.getByRole("button", { name: /download/i })).toBeDefined();
  });

  it("switches registry tools without remounting the stage or resetting document view", async () => {
    render(<ToolWorkspace />);
    await completeAutomaticWorkspace();
    const stage = screen.getByTestId("editor-stage");
    const previewStack = screen.getByTestId("persistent-preview-stack");
    const comparison = screen.getByTestId("before-after-frame");
    const objectUrlSpy = vi.spyOn(URL, "createObjectURL");
    const objectUrlCalls = objectUrlSpy.mock.calls.length;
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("55");

    fireEvent.click(screen.getByRole("button", { name: /^Enhancements$/ }));
    expect(screen.getByTestId("editor-stage")).toBe(stage);
    expect(screen.getByTestId("persistent-preview-stack")).toBe(previewStack);
    expect(screen.getByTestId("before-after-frame")).toBe(comparison);
    expect(objectUrlSpy.mock.calls.length).toBe(objectUrlCalls);
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("55");
    expect(screen.getByTestId("tool-panel-slot").getAttribute("data-active-tool")).toBe(
      "enhance",
    );

    fireEvent.click(screen.getByRole("button", { name: /^Background$/ }));
    expect(screen.getByTestId("editor-stage")).toBe(stage);
    expect(screen.getByTestId("persistent-preview-stack")).toBe(previewStack);
    expect(screen.getByTestId("before-after-frame")).toBe(comparison);
    expect(objectUrlSpy.mock.calls.length).toBe(objectUrlCalls);
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

  it("guards an unsaved Cutout draft before returning to upload", async () => {
    render(<ToolWorkspace />);
    await enterMagicDraft();

    fireEvent.click(screen.getByRole("button", { name: /back to upload/i }));

    expect(screen.getByTestId("editor-draft-guard")).toBeDefined();
    expect(screen.queryByLabelText("Upload an image")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /continue editing/i }));
    expect(screen.queryByTestId("editor-draft-guard")).toBeNull();
    expect(screen.getByTestId("cutout-tool-panel")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /back to upload/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));

    await waitFor(() => expect(screen.getByLabelText("Upload an image")).toBeDefined());
  });

  it("replaces the technical refinement cards with one benefit-led Enhancements panel", async () => {
    render(<ToolWorkspace />);
    await completeAutomaticWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /^Enhancements$/ }));

    const panel = screen.getByTestId("enhancements-tool-panel");
    expect(screen.getByRole("checkbox", { name: /improve fine details/i })).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /remove colour halo/i })).toBeDefined();
    expect(panel.textContent).not.toMatch(
      /refine soft edges|clean edge colours|skip and edit with brush|ViTMatte|WASM|WebGPU|MiB/i,
    );
    expect(screen.queryByTestId("matte-refinement-controls")).toBeNull();
    expect(screen.queryByTestId("foreground-refinement-controls")).toBeNull();
  });

  it("Manual paints an exact-alpha draft and Apply commits one manual operation", async () => {
    render(<ToolWorkspace />);
    const worker = await completeAutomaticWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: "Manual" }));
    await waitFor(() =>
      expect(screen.getByRole("img", { name: /mask correction canvas/i })).toBeDefined(),
    );
    expect(screen.getByRole("group", { name: /brush mode/i })).toBeDefined();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/mask editor zoom 100%/i),
    );

    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/mask editor zoom 125%/i),
    );

    const canvas = screen.getByRole("img", { name: /mask correction canvas/i });
    Object.defineProperties(canvas, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: vi.fn(() => true) },
      releasePointerCapture: { value: vi.fn() },
      getBoundingClientRect: {
        value: vi.fn(() => ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        })),
      },
    });
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      button: 0,
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 220, clientY: 220 });
    const apply = screen.getByRole<HTMLButtonElement>("button", { name: /^apply$/i });
    await waitFor(() => expect(apply.disabled).toBe(false));
    fireEvent.click(apply);
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
          alphaMatte: {
            width: 800,
            height: 600,
            data: new Uint8ClampedArray(800 * 600).fill(255),
          },
        },
        durationMs: 5,
      });
    });

    await waitFor(() =>
      expect(
        screen.getByTestId("tool-workspace").getAttribute("data-document-revision"),
      ).toBe("1"),
    );
    expect(apply.disabled).toBe(true);
  });

  it("preserves the committed document when Manual preparation fails", async () => {
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
    fireEvent.click(screen.getByRole("tab", { name: "Manual" }));
    await waitFor(() =>
      expect(
        worker.posted.filter((message) => message.type === "extract-alpha-matte"),
      ).toHaveLength(1),
    );
    const extractRequests = worker.posted.filter(
      (message) => message.type === "extract-alpha-matte",
    );
    const extractRequest = extractRequests.at(-1);
    act(() => {
      worker.emit({
        type: "error",
        code: "compositing-failed",
        requestId: extractRequest?.requestId,
        message: "OffscreenCanvas unavailable",
      });
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/OffscreenCanvas unavailable/i);
    expect(screen.getByRole("button", { name: /^reset$/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(
        worker.posted.filter((message) => message.type === "extract-alpha-matte"),
      ).toHaveLength(2),
    );
  });
});
