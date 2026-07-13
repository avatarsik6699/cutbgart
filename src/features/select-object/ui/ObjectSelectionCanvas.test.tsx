import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ObjectSelectionCanvas } from "./ObjectSelectionCanvas";

const source = {
  blob: new Blob(["image"], { type: "image/jpeg" }),
  width: 800,
  height: 400,
  format: "image/jpeg" as const,
};

const baseProps = {
  source,
  status: "ready-for-prompt" as const,
  matte: null,
  prompt: null,
  progress: null,
  error: null,
  onPrompt: vi.fn(),
  onAccept: vi.fn(),
  onReplace: vi.fn(),
  onRetry: vi.fn(),
  onCancel: vi.fn(),
};

class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:guided");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.stubGlobal("ImageData", FakeImageData);
  vi.spyOn(HTMLImageElement.prototype, "getBoundingClientRect").mockReturnValue({
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

describe("ObjectSelectionCanvas", () => {
  it("maps a point against the rendered image and displays its marker", () => {
    const onPrompt = vi.fn();
    const { rerender } = render(
      <ObjectSelectionCanvas {...baseProps} onPrompt={onPrompt} />,
    );
    fireEvent.pointerDown(screen.getByRole("img"), { clientX: 60, clientY: 45 });
    expect(onPrompt).toHaveBeenCalledWith({ type: "point", x: 0.25, y: 0.25, label: 1 });

    rerender(
      <ObjectSelectionCanvas
        {...baseProps}
        onPrompt={onPrompt}
        status="predicting-mask"
        prompt={{ type: "point", x: 0.25, y: 0.25, label: 1 }}
      />,
    );
    expect(screen.getByTestId("guided-point-marker").getAttribute("style")).toContain(
      "left: 25%",
    );
  });

  it("draws a box while dragging and submits its normalized bounds", () => {
    const onPrompt = vi.fn();
    render(<ObjectSelectionCanvas {...baseProps} onPrompt={onPrompt} />);
    fireEvent.click(screen.getByRole("button", { name: /Box|Рамка/ }));
    const image = screen.getByRole("img");
    Object.defineProperty(image, "setPointerCapture", { value: vi.fn() });
    fireEvent.pointerDown(image, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 170, clientY: 100 });
    expect(screen.getByTestId("guided-box-draft")).toBeDefined();
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 170, clientY: 100 });
    expect(onPrompt).toHaveBeenCalledWith({
      type: "box",
      xMin: 0.1,
      yMin: 0.1,
      xMax: 0.8,
      yMax: 0.8,
    });
  });

  it("renders the returned mask and makes replacement clear the prompt", () => {
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    const onReplace = vi.fn();
    render(
      <ObjectSelectionCanvas
        {...baseProps}
        status="preview"
        matte={{ width: 2, height: 1, data: new Uint8ClampedArray([255, 0]) }}
        prompt={{ type: "point", x: 0.5, y: 0.5, label: 1 }}
        onReplace={onReplace}
      />,
    );
    fireEvent.load(screen.getByRole("img"));
    expect(screen.getByTestId("guided-mask-overlay")).toBeDefined();
    expect(putImageData).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Replace|Заменить/ }));
    expect(onReplace).toHaveBeenCalledOnce();
  });
});
