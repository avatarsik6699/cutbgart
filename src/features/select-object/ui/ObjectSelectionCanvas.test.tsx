import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPromptSession } from "../model/prompt-session";
import { ObjectSelectionCanvas } from "./ObjectSelectionCanvas";

const source = {
  blob: new Blob(["image"], { type: "image/jpeg" }),
  width: 800,
  height: 400,
  format: "image/jpeg" as const,
};
const session = createPromptSession(source, null, "layer-1");
const baseProps = {
  session,
  status: "ready-for-prompt" as const,
  matteRef: { current: null },
  matteRevision: 0,
  hasMatte: false,
  progress: null,
  error: null,
  onPoint: vi.fn(),
  onBox: vi.fn(),
  onStroke: vi.fn(),
  onAddLayer: vi.fn(),
  onSelectLayer: vi.fn(),
  onRemoveLayer: vi.fn(),
  onSelectCandidate: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onResetLayer: vi.fn(),
  onAccept: vi.fn(),
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
  it("recreates the source blob URL after a StrictMode ref cleanup", () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:guided-${String(created.length + 1)}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => revoked.push(url));
    render(
      <StrictMode>
        <ObjectSelectionCanvas {...baseProps} />
      </StrictMode>,
    );
    const current = created.at(-1)!;
    expect(created.length).toBeGreaterThan(1);
    expect(revoked).not.toContain(current);
    expect(screen.getByRole("img").getAttribute("src")).toBe(current);
  });

  it("maps positive and negative points against the responsive image", () => {
    const onPoint = vi.fn();
    render(<ObjectSelectionCanvas {...baseProps} onPoint={onPoint} />);
    const image = screen.getByRole("img");
    fireEvent.pointerDown(image, { clientX: 60, clientY: 45 });
    expect(onPoint).toHaveBeenCalledWith(0.25, 0.25, 1);
    fireEvent.click(screen.getByRole("button", { name: /Remove point|Точка: удалить/ }));
    fireEvent.keyDown(image, { key: "Enter" });
    expect(onPoint).toHaveBeenLastCalledWith(0.5, 0.5, 0);
  });

  it("submits box and semantic stroke only when the gesture completes", () => {
    const onBox = vi.fn();
    const onStroke = vi.fn();
    render(<ObjectSelectionCanvas {...baseProps} onBox={onBox} onStroke={onStroke} />);
    const image = screen.getByRole("img");
    Object.defineProperty(image, "setPointerCapture", { value: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: /^Box$|^Рамка$/ }));
    fireEvent.pointerDown(image, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 170, clientY: 100 });
    expect(onBox).not.toHaveBeenCalled();
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 170, clientY: 100 });
    expect(onBox).toHaveBeenCalledWith({ xMin: 0.1, yMin: 0.1, xMax: 0.8, yMax: 0.8 });

    fireEvent.click(screen.getByRole("button", { name: /Keep stroke|Штрих: оставить/ }));
    fireEvent.pointerDown(image, { pointerId: 2, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(image, { pointerId: 2, clientX: 80, clientY: 50 });
    expect(onStroke).not.toHaveBeenCalled();
    fireEvent.pointerUp(image, { pointerId: 2, clientX: 100, clientY: 60 });
    expect(onStroke).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "keep", radius: 8 }),
    );
  });

  it("renders accumulated prompts, candidates, and the selected mask", () => {
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    const candidateMatte = { width: 2, height: 1, data: new Uint8ClampedArray([255, 0]) };
    const populated = {
      ...session,
      layers: [
        {
          ...session.layers[0]!,
          points: [{ id: "p", x: 0.5, y: 0.5, label: 1 as const }],
          candidates: [
            { id: "a", matte: candidateMatte, score: 0.9, differenceRatio: 0 },
            { id: "b", matte: candidateMatte, score: 0.7, differenceRatio: 0 },
          ],
          selectedCandidateId: "a",
          acceptedMatte: candidateMatte,
        },
      ],
    };
    render(
      <ObjectSelectionCanvas
        {...baseProps}
        session={populated}
        status="preview"
        matteRef={{ current: candidateMatte }}
        matteRevision={1}
        hasMatte
      />,
    );
    fireEvent.load(screen.getByRole("img"));
    expect(screen.getByTestId("guided-positive-marker")).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByTestId("guided-mask-overlay")).toBeDefined();
    expect(putImageData).toHaveBeenCalled();
    expect(screen.getByText(/Blue overlay|Голубая область/)).toBeDefined();
  });

  it("supports prompt-history shortcuts without hijacking text inputs", () => {
    const historyEntry = {
      type: "layer-selected" as const,
      beforeId: "layer-1",
      afterId: "layer-1",
    };
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const withHistory = {
      ...session,
      history: [historyEntry],
      redo: [historyEntry],
    };
    render(
      <ObjectSelectionCanvas
        {...baseProps}
        session={withHistory}
        onUndo={onUndo}
        onRedo={onRedo}
      />,
    );
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledTimes(2);

    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledOnce();
    input.remove();
  });
});
