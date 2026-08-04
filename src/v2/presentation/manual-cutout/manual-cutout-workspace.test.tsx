import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ManualCutoutWorkspace,
  type ManualCutoutInteraction,
} from "./manual-cutout-workspace";

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
  it("uses only semantic interaction commands for canvas setup, history, and completion", () => {
    const harness = interactionHarness();
    render(
      <ManualCutoutWorkspace
        documentId="document-1"
        height={10}
        interaction={harness.interaction}
        sourceUrl="blob:source"
        width={10}
      />,
    );

    expect(harness.calls.connectCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      "blob:source",
      10,
      10,
    );

    fireEvent.click(screen.getByRole("button", { name: /Undo stroke|Отменить мазок/ }));
    fireEvent.click(screen.getByRole("button", { name: /Redo stroke|Повторить мазок/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Apply$|^Применить$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));

    expect(harness.calls.undo).toHaveBeenCalledOnce();
    expect(harness.calls.redo).toHaveBeenCalledOnce();
    expect(harness.calls.apply).toHaveBeenCalledOnce();
    expect(harness.calls.cancel).toHaveBeenCalledOnce();
  });
});
