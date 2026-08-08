import { Profiler } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDocumentId,
  createMagicCandidateId,
  createMagicDraftId,
  type MagicCutoutTypes,
} from "@/editor/domain";
import {
  MagicCutoutWorkspace,
  type MagicCutoutInteraction,
} from "./magic-cutout-workspace";
import { cutoutStageContentStyle } from "../cutout-stage";

const candidateId = createMagicCandidateId("candidate-1");
const draft: MagicCutoutTypes.Draft = {
  kind: "magic-cutout",
  documentId: createDocumentId("document-1"),
  draftId: createMagicDraftId("draft-1"),
  baselineRevision: 0,
  draftRevision: 1,
  dirty: true,
  status: "preview",
  selectedCandidateId: candidateId,
};

function sessionHarness() {
  const calls = {
    apply: vi.fn(),
    cancel: vi.fn(),
    redo: vi.fn(),
    undo: vi.fn(),
  };
  const interaction = {
    apply: calls.apply,
    appendPoint: vi.fn(),
    beginStroke: vi.fn(() => true),
    cancel: calls.cancel,
    cancelStroke: vi.fn(),
    commitStroke: vi.fn(() => true),
    displayStrokes: () => [],
    readViewState: () => ({ mode: "keep" as const, radius: 18 }),
    redo: calls.redo,
    snapshot: () => ({ strokeCount: 1, canUndo: true, canRedo: true }),
    undo: calls.undo,
    writeViewState: vi.fn(),
  } as unknown as MagicCutoutInteraction;
  return { calls, interaction };
}

function supportPointerCapture(element: HTMLElement): void {
  Object.assign(element, {
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
  });
}

describe("MagicCutoutWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      arc: vi.fn(),
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it("exposes only automatic-best Apply and dirty Cancel completion actions", () => {
    const harness = sessionHarness();
    render(
      <MagicCutoutWorkspace
        applying={false}
        draft={draft}
        height={10}
        runtimeProgress={null}
        interaction={harness.interaction}
        currentUrl="blob:source"
        width={10}
      />,
    );

    expect(screen.queryByRole("button", { name: /Predict|Предсказать/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Candidate|Вариант/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Undo stroke|Отменить мазок/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Apply$|^Применить$/ }));
    expect(harness.calls.apply).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));
    const dialog = screen.getByRole("alertdialog");
    const continueButton = screen.getByRole("button", {
      name: /Continue editing|Продолжить редактирование/,
    });
    expect(document.activeElement).toBe(continueButton);
    expect(harness.calls.cancel).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Discard draft|Отбросить черновик/ }),
    );
    expect(harness.calls.cancel).toHaveBeenCalledOnce();
  });

  it("leaves global keyboard history routing to the document owner", () => {
    const harness = sessionHarness();
    render(
      <MagicCutoutWorkspace
        applying={false}
        draft={{ ...draft, status: "dirty", selectedCandidateId: null }}
        height={10}
        runtimeProgress={null}
        interaction={harness.interaction}
        currentUrl="blob:source"
        width={10}
      />,
    );

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(harness.calls.undo).not.toHaveBeenCalled();
    expect(harness.calls.redo).not.toHaveBeenCalled();
  });

  it("explains the cold start and blocks the stage during Apply", () => {
    const harness = sessionHarness();
    render(
      <MagicCutoutWorkspace
        applying
        draft={draft}
        height={10}
        runtimeProgress={null}
        interaction={harness.interaction}
        currentUrl="blob:source"
        width={10}
      />,
    );

    expect(screen.getByTestId("editor-stage-placeholder").textContent).toMatch(
      /Applying the selected Magic|Применяем выбранный магический/,
    );
    expect(screen.getByText(/first Magic Apply|Первое применение Magic/)).toBeDefined();
  });

  it("keeps a circular cursor and caps the display-only stroke buffer", () => {
    const harness = sessionHarness();
    render(
      <MagicCutoutWorkspace
        applying={false}
        draft={draft}
        height={2000}
        runtimeProgress={null}
        interaction={harness.interaction}
        currentUrl="blob:source"
        width={4000}
      />,
    );

    const cursor = screen.getByTestId("magic-brush-cursor");
    expect(cursor.style.width).toBe("0.9%");
    expect(cursor.style.height).toBe("1.8%");
    expect(cursor.className).not.toContain("border-dashed");
    expect(cursor.childElementCount).toBe(0);
    const viewport = screen.getByTestId("cutout-stage-viewport");
    expect(viewport.className).toContain("overflow-hidden");
    expect(cutoutStageContentStyle(4000, 2000)).toMatchObject({
      width: "min(100cqw, 200cqh)",
      height: "min(100cqh, 50cqw)",
    });
    const canvas = screen.getByLabelText(/Paint Keep and Remove|Нарисуйте подсказки/);
    expect(canvas.getAttribute("width")).toBe("1600");
    expect(canvas.getAttribute("height")).toBe("800");
  });

  it("temporarily exposes the grab cursor while Space is held", () => {
    const harness = sessionHarness();
    render(
      <MagicCutoutWorkspace
        applying={false}
        draft={draft}
        height={10}
        runtimeProgress={null}
        interaction={harness.interaction}
        currentUrl="blob:current-result"
        width={10}
      />,
    );
    const viewport = screen.getByTestId("cutout-stage-viewport");
    const canvas = screen.getByLabelText(/Paint Keep and Remove|Нарисуйте подсказки/);
    supportPointerCapture(canvas);

    fireEvent.pointerEnter(viewport);
    expect(viewport.getAttribute("data-workspace-active")).toBe("true");
    const spaceDown = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(spaceDown);
    expect(spaceDown.defaultPrevented).toBe(true);
    expect(viewport.getAttribute("data-space-panning")).toBe("true");
    expect(canvas.style.cursor).toBe("grab");
    fireEvent.keyUp(window, { key: " " });
    expect(viewport.getAttribute("data-space-panning")).toBe("false");
    expect(canvas.style.cursor).toBe("none");
    fireEvent.pointerDown(canvas, { button: 1, pointerId: 4 });
    expect(viewport.getAttribute("data-panning")).toBe("true");
    expect(canvas.style.cursor).toBe("grabbing");
    expect(screen.getByTestId("magic-brush-cursor").hidden).toBe(true);
    fireEvent.pointerUp(canvas, { button: 1, pointerId: 4 });
    expect(viewport.getAttribute("data-panning")).toBe("false");
    fireEvent.click(
      screen.getByRole("button", { name: /Pan image|Перемещать изображение/ }),
    );
    expect(canvas.style.cursor).toBe("grab");
  });

  it("keeps Space and middle-button pan outside React commits", () => {
    const harness = sessionHarness();
    const onRender = vi.fn();
    render(
      <Profiler id="magic-workspace" onRender={onRender}>
        <MagicCutoutWorkspace
          applying={false}
          draft={draft}
          height={100}
          runtimeProgress={null}
          interaction={harness.interaction}
          currentUrl="blob:source"
          width={100}
        />
      </Profiler>,
    );
    const viewport = screen.getByTestId("cutout-stage-viewport");
    const canvas = screen.getByLabelText(/Paint Keep and Remove|Нарисуйте подсказки/);
    supportPointerCapture(canvas);
    fireEvent.pointerEnter(viewport);
    const committedBeforeGesture = onRender.mock.calls.length;

    fireEvent.keyDown(window, { key: " " });
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 7,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(canvas, { button: 0, pointerId: 7, clientX: 30, clientY: 30 });
    fireEvent.keyUp(window, { key: " " });
    fireEvent.pointerDown(canvas, { button: 1, pointerId: 8 });
    fireEvent.pointerUp(canvas, { button: 1, pointerId: 8 });

    expect(onRender).toHaveBeenCalledTimes(committedBeforeGesture);
  });

  it("updates brush radius without committing a React render", () => {
    const harness = sessionHarness();
    const onRender = vi.fn();
    render(
      <Profiler id="magic-workspace" onRender={onRender}>
        <MagicCutoutWorkspace
          applying={false}
          draft={draft}
          height={2000}
          runtimeProgress={null}
          interaction={harness.interaction}
          currentUrl="blob:source"
          width={4000}
        />
      </Profiler>,
    );
    const committedBeforeInput = onRender.mock.calls.length;

    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });

    expect(onRender).toHaveBeenCalledTimes(committedBeforeInput);
    expect(harness.interaction.writeViewState).toHaveBeenLastCalledWith({
      mode: "keep",
      radius: 40,
    });
    const cursor = screen.getByTestId("magic-brush-cursor");
    expect(cursor.style.width).toBe("2%");
    expect(cursor.style.height).toBe("4%");
  });
});
