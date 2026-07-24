import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGuidedBrushSession,
  createGuidedBrushViewSession,
} from "../model/guided-brush-session";
import { GuidedBrushCanvas } from "./GuidedBrushCanvas";

const source = {
  blob: new Blob(["image"], { type: "image/jpeg" }),
  width: 800,
  height: 400,
  format: "image/jpeg" as const,
};
const session = createGuidedBrushViewSession({
  ...createGuidedBrushSession(source, null, 12),
  status: "ready" as const,
});
const props = {
  session,
  status: "ready" as const,
  matteRef: { current: null },
  matteRevision: 0,
  baseMatteRef: { current: null },
  baseMatteRevision: null,
  entryKind: "direct" as const,
  resultColorSource: source.blob,
  hasMatte: false,
  progress: null,
  error: null,
  errorCode: null,
  canAccept: false,
  onStroke: vi.fn(),
  onBrushRadiusChange: vi.fn(),
  onSelectCandidate: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onClear: vi.fn(),
  onRecompute: vi.fn(),
  onContinueFromResult: vi.fn(),
  onAccept: vi.fn(),
  onRetry: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:guided-brush");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 10,
    top: 20,
    width: 200,
    height: 100,
    right: 210,
    bottom: 120,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GuidedBrushCanvas", () => {
  it("recreates its blob URL across a StrictMode ref cleanup", () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:brush-${String(created.length + 1)}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => revoked.push(url));
    render(
      <StrictMode>
        <GuidedBrushCanvas {...props} />
      </StrictMode>,
    );
    const editorUrl = screen.getByTestId("guided-brush-edit-source").getAttribute("src")!;
    expect(created.length).toBeGreaterThan(1);
    expect(created).toContain(editorUrl);
    expect(revoked).not.toContain(editorUrl);
  });

  it("commits only on pointer-up with the displayed source-space radius", () => {
    const onStroke = vi.fn();
    render(<GuidedBrushCanvas {...props} onStroke={onStroke} />);
    const image = screen.getByTestId("guided-brush-edit-image");
    Object.defineProperty(image, "setPointerCapture", { value: vi.fn() });
    fireEvent.pointerDown(image, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 30,
      clientY: 30,
    });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 100, clientY: 60 });
    expect(onStroke).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId("guided-brush-draft")
        .querySelector("polyline")
        ?.getAttribute("stroke-width"),
    ).toBe("24");
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 170, clientY: 100 });
    expect(onStroke).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "keep", radius: 12 }),
    );
    expect(screen.getByTestId("guided-brush-cursor").tagName.toLowerCase()).toBe(
      "circle",
    );
    expect(screen.getByTestId("guided-brush-cursor").getAttribute("r")).toBe("12");
    expect(screen.getByTestId("guided-brush-core-cursor").getAttribute("r")).toBe("4");
    expect(
      screen
        .getByTestId("guided-brush-cursor")
        .closest("svg")
        ?.getAttribute("preserveAspectRatio"),
    ).toBe("xMidYMid meet");
  });

  it("keeps the custom cursor fixed when primary-pointer capture starts", () => {
    render(<GuidedBrushCanvas {...props} />);
    const surface = screen.getByTestId("guided-brush-edit-image");
    const stableRect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      right: 210,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    };
    const shiftedRect = { ...stableRect, left: 14, right: 214, x: 14 };
    const rect = vi.fn().mockReturnValueOnce(stableRect).mockReturnValue(shiftedRect);
    Object.defineProperty(surface, "getBoundingClientRect", { value: rect });
    Object.defineProperty(surface, "setPointerCapture", { value: vi.fn() });

    fireEvent.pointerEnter(surface, { pointerId: 1, clientX: 110, clientY: 70 });
    const cursor = screen.getByTestId("guided-brush-cursor");
    const coreCursor = screen.getByTestId("guided-brush-core-cursor");
    const hoverPosition = {
      x: cursor.getAttribute("cx"),
      y: cursor.getAttribute("cy"),
    };
    const dispatched = fireEvent.pointerDown(surface, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 110,
      clientY: 70,
    });

    expect(dispatched).toBe(false);
    expect(rect).toHaveBeenCalledTimes(1);
    expect(cursor.getAttribute("cx")).toBe(hoverPosition.x);
    expect(cursor.getAttribute("cy")).toBe(hoverPosition.y);
    expect(coreCursor.getAttribute("cx")).toBe(hoverPosition.x);
    expect(coreCursor.getAttribute("cy")).toBe(hoverPosition.y);
  });

  it("announces dirty state and supports a keyboard brush gesture", () => {
    const onStroke = vi.fn();
    render(
      <GuidedBrushCanvas
        {...props}
        status="dirty"
        session={{ ...session, status: "dirty" }}
        onStroke={onStroke}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/markings changed/i);
    fireEvent.keyDown(screen.getByTestId("guided-brush-edit-image"), { key: "Enter" });
    expect(onStroke).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "keep", radius: 12 }),
    );
  });

  it("keeps a clean result separate and marks it stale after newer markings", () => {
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(200 * 100 * 4).fill(255),
      width: 200,
      height: 100,
    }));
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      drawImage,
      getImageData,
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    const matte = {
      width: 800,
      height: 400,
      data: Uint8ClampedArray.from({ length: 800 * 400 }, (_, index) =>
        index % 800 < 400 ? 0 : 255,
      ),
    };
    const stableMatteRef = { current: matte };
    const { rerender } = render(
      <GuidedBrushCanvas
        {...props}
        hasMatte
        matteRef={stableMatteRef}
        matteRevision="result-1"
      />,
    );
    const editImage = screen.getByTestId("guided-brush-edit-image");
    const resultImage = screen.getByTestId("guided-brush-result-source");
    fireEvent.load(resultImage);
    const initialPaintCount = putImageData.mock.calls.length;
    expect(screen.getByTestId("guided-brush-result-canvas")).toBeDefined();
    expect(editImage.parentElement?.querySelectorAll("canvas")).toHaveLength(1);
    const paintedPixels = putImageData.mock.calls.at(-1)?.[0] as ImageData;
    expect(paintedPixels.data[3]).toBe(0);
    expect(paintedPixels.data.at(-1)).toBe(255);
    rerender(
      <GuidedBrushCanvas
        {...props}
        status="dirty"
        session={{
          ...session,
          status: "dirty",
          revision: session.revision + 1,
          computedRevision: session.revision,
        }}
        hasMatte
        matteRef={stableMatteRef}
        matteRevision="result-1"
      />,
    );
    expect(putImageData).toHaveBeenCalledTimes(initialPaintCount);
    expect(screen.getByTestId("guided-brush-result-stale")).toBeDefined();
  });

  it("uses one undistorted source-aspect frame for both panes", () => {
    render(<GuidedBrushCanvas {...props} />);
    const editor = screen.getByTestId("guided-brush-edit-frame");
    const result = screen.getByTestId("guided-brush-result-checkerboard");
    expect(editor.style.aspectRatio).toBe("800 / 400");
    expect(result.style.aspectRatio).toBe("800 / 400");
    expect(editor.style.width).toBe(result.style.width);
  });

  it("uses the processed foreground colour layer in the clean result preview", () => {
    const foreground = new Blob(["processed-foreground"], { type: "image/png" });
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) =>
      blob === foreground ? "blob:processed-foreground" : "blob:original-source",
    );
    render(<GuidedBrushCanvas {...props} resultColorSource={foreground} />);
    expect(screen.getByTestId("guided-brush-result-source").getAttribute("src")).toBe(
      "blob:processed-foreground",
    );
    expect(screen.getByTestId("guided-brush-edit-source").getAttribute("src")).toBe(
      "blob:original-source",
    );
  });

  it("coalesces observer and window resize paints into one animation frame", () => {
    let observerCallback: ResizeObserverCallback | null = null;
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    let scheduledPaint: FrameRequestCallback | null = null;
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        scheduledPaint = callback;
        return 1;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      drawImage,
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(200 * 100 * 4).fill(255),
        width: 200,
        height: 100,
      })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const baseMatte = {
      width: 800,
      height: 400,
      data: new Uint8ClampedArray(800 * 400).fill(255),
    };
    render(
      <GuidedBrushCanvas
        {...props}
        session={{ ...session, hasBaseMatte: true }}
        entryKind="processed"
        baseMatteRef={{ current: baseMatte }}
        baseMatteRevision={1}
      />,
    );
    const initialPaintCount = drawImage.mock.calls.length;
    expect(initialPaintCount).toBeGreaterThan(0);

    (observerCallback as ResizeObserverCallback | null)?.([], {} as ResizeObserver);
    window.dispatchEvent(new Event("resize"));
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledTimes(initialPaintCount);

    (scheduledPaint as FrameRequestCallback | null)?.(0);
    expect(drawImage).toHaveBeenCalledTimes(initialPaintCount + 1);
  });

  it("shows the processed base with removed pixels as faint context", () => {
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(200 * 100 * 4).fill(255),
        width: 200,
        height: 100,
      })),
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    const baseMatte = {
      width: 800,
      height: 400,
      data: Uint8ClampedArray.from({ length: 800 * 400 }, (_, index) =>
        index % 800 < 400 ? 0 : 255,
      ),
    };
    render(
      <GuidedBrushCanvas
        {...props}
        session={{ ...session, hasBaseMatte: true }}
        entryKind="processed"
        baseMatteRef={{ current: baseMatte }}
        baseMatteRevision={0}
      />,
    );
    fireEvent.load(screen.getByTestId("guided-brush-edit-source"));
    const paintedPixels = putImageData.mock.calls.at(-1)?.[0] as ImageData;
    expect(paintedPixels.data[3]).toBe(46);
    expect(paintedPixels.data.at(-1)).toBe(255);
    expect(screen.getByTestId("guided-brush-removed-context-legend")).toBeDefined();
    expect(screen.getAllByText("Base & markings")).toHaveLength(2);
  });
});
