import { Profiler } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ManualCutoutWorkspace,
  type ManualCutoutInteraction,
} from "./manual-cutout-workspace";
import { cutoutStageContentStyle } from "../cutout-stage";

function interactionHarness() {
  const calls = {
    apply: vi.fn(),
    cancel: vi.fn(),
    connectCanvas: vi.fn(() => vi.fn()),
    redo: vi.fn(),
    undo: vi.fn(),
  };
  const interaction: ManualCutoutInteraction = {
    apply: calls.apply,
    begin: vi.fn(),
    cancel: calls.cancel,
    cancelGesture: vi.fn(),
    connectCanvas: calls.connectCanvas,
    end: vi.fn(),
    move: vi.fn(),
    readViewState: () => ({ mode: "restore", brushSize: 48, zoom: 1 }),
    redo: calls.redo,
    snapshot: () => ({ canRedo: true, canUndo: true, dirty: true }),
    undo: calls.undo,
    writeViewState: vi.fn(),
  };
  return { calls, interaction };
}

describe("ManualCutoutWorkspace", () => {
  afterEach(cleanup);

  it("uses only semantic interaction commands for canvas setup, history, and completion", () => {
    const harness = interactionHarness();
    render(
      <ManualCutoutWorkspace
        documentId="document-1"
        height={10}
        interaction={harness.interaction}
        currentUrl="blob:source"
        width={10}
      />,
    );

    expect(harness.calls.connectCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      "blob:source",
      10,
      10,
    );

    expect(
      screen.queryByRole("button", { name: /Undo stroke|Отменить мазок/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Redo stroke|Повторить мазок/ }),
    ).toBeNull();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /^Apply$|^Применить$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));

    expect(harness.calls.undo).toHaveBeenCalledOnce();
    expect(harness.calls.redo).toHaveBeenCalledOnce();
    expect(harness.calls.apply).toHaveBeenCalledOnce();
    expect(harness.calls.cancel).toHaveBeenCalledOnce();
  });

  it("updates brush size without committing a React render", () => {
    const harness = interactionHarness();
    const onRender = vi.fn();
    render(
      <Profiler id="manual-workspace" onRender={onRender}>
        <ManualCutoutWorkspace
          documentId="document-1"
          height={2000}
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
      mode: "restore",
      brushSize: 80,
      zoom: 1,
    });
    const cursor = screen.getByTestId("manual-brush-cursor");
    expect(cursor.style.width).toBe("2%");
    expect(cursor.style.height).toBe("4%");
    expect(cursor.className).toContain("border-white");
    expect(cursor.className).not.toContain("border-dashed");
    expect(cursor.childElementCount).toBe(0);
  });

  it("uses the shared full-fit viewport and Space grab mode", () => {
    const harness = interactionHarness();
    render(
      <ManualCutoutWorkspace
        documentId="document-1"
        height={2000}
        interaction={harness.interaction}
        currentUrl="blob:current-result"
        width={4000}
      />,
    );
    const viewport = screen.getByTestId("cutout-stage-viewport");
    const canvas = screen.getByRole("img", { name: /Manual cutout|Ручн/ });
    expect(viewport.className).toContain("overflow-hidden");
    expect(cutoutStageContentStyle(4000, 2000)).toMatchObject({
      width: "min(100cqw, 200cqh)",
      height: "min(100cqh, 50cqw)",
    });

    fireEvent.keyDown(window, { key: " " });
    expect(viewport.getAttribute("data-space-panning")).toBe("true");
    expect(canvas.className).toContain("cursor-grab");
    fireEvent.keyUp(window, { key: " " });
    expect(viewport.getAttribute("data-space-panning")).toBe("false");
  });
});
