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
  ...createGuidedBrushSession(
    source,
    {
      width: 800,
      height: 400,
      data: new Uint8ClampedArray(320_000).fill(255),
    },
    12,
  ),
  status: "ready" as const,
});
const viewportControls = {
  viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
  zoomPercent: 100,
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomByWheel: vi.fn(),
  resetView: vi.fn(),
  panView: vi.fn(),
  panBySourcePixels: vi.fn(),
};
const props = {
  session,
  status: "ready" as const,
  baseMatteRef: { current: null },
  baseMatteRevision: null,
  entryKind: "processed" as const,
  mode: "keep" as const,
  viewportControls,
  onStroke: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
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
});

describe("GuidedBrushCanvas", () => {
  it("renders a thin dashed footprint and solid core cursor", () => {
    render(<GuidedBrushCanvas {...props} />);

    expect(screen.getByTestId("guided-brush-edit-frame").className).toContain(
      "transparency-grid",
    );
    expect(
      screen.getByTestId("guided-brush-cursor").getAttribute("stroke-dasharray"),
    ).toBe("3 2");
    expect(screen.getByTestId("guided-brush-cursor").getAttribute("stroke-width")).toBe(
      "1",
    );
    expect(
      screen.getByTestId("guided-brush-core-cursor").getAttribute("stroke-dasharray"),
    ).toBeNull();
  });

  it("uses a stable Skeleton overlay and no wait cursor while Magic is busy", () => {
    render(<GuidedBrushCanvas {...props} status="predicting" />);

    expect(screen.getByTestId("guided-brush-busy-skeleton")).toBeDefined();
    expect(screen.getByTestId("guided-brush-edit-image").className).not.toContain(
      "cursor-wait",
    );
    expect(screen.getByTestId("guided-brush-cursor").style.opacity).toBe("0");
  });

  it("recreates its blob URL across a StrictMode ref cleanup", () => {
    const created: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:brush-${String(created.length + 1)}`;
      created.push(url);
      return url;
    });
    render(
      <StrictMode>
        <GuidedBrushCanvas {...props} />
      </StrictMode>,
    );
    expect(created.length).toBeGreaterThan(1);
  });

  it("commits one source-space stroke on pointer-up and keeps one visual stage", () => {
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
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 170, clientY: 100 });
    expect(onStroke).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "keep", radius: 12 }),
    );
    expect(screen.queryByTestId("guided-brush-result-pane")).toBeNull();
    expect(screen.queryByTestId("guided-brush-candidates")).toBeNull();
  });

  it("supports keyboard painting and shares the supplied zoom/pan controller", () => {
    const onStroke = vi.fn();
    const controls = {
      ...viewportControls,
      viewport: { zoom: 2, offsetX: 80, offsetY: 20 },
      zoomPercent: 200,
      zoomIn: vi.fn(),
      panView: vi.fn(),
    };
    render(
      <GuidedBrushCanvas {...props} onStroke={onStroke} viewportControls={controls} />,
    );
    const editor = screen.getByRole("application", { name: /magic cutout editor/i });
    expect(editor.getAttribute("data-zoom")).toBe("200");
    fireEvent.keyDown(screen.getByTestId("guided-brush-edit-image"), { key: "Enter" });
    expect(onStroke).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "keep", radius: 12 }),
    );

    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(controls.zoomIn).toHaveBeenCalled();
    expect(controls.panView).toHaveBeenCalledWith(1, 0, "normal");
  });

  it("keeps draft undo/redo shortcuts scoped to the mounted Magic editor", () => {
    const onUndo = vi.fn();
    const dirty = {
      ...session,
      history: [
        {
          id: "stroke",
          mode: "keep" as const,
          points: [{ x: 0.5, y: 0.5 }],
          radius: 12,
        },
      ],
    };
    render(<GuidedBrushCanvas {...props} session={dirty} onUndo={onUndo} />);
    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
