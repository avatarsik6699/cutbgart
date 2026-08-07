import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentHistoryShortcuts } from "./document-history-shortcuts";

const history = vi.hoisted(() => ({
  canRedo: true,
  canUndo: true,
  redo: vi.fn(),
  undo: vi.fn(),
}));

vi.mock("./use-toolbar-history", () => ({
  useToolbarHistory: () => history,
}));

describe("DocumentHistoryShortcuts", () => {
  afterEach(() => {
    cleanup();
    history.canRedo = true;
    history.canUndo = true;
    history.redo.mockReset();
    history.undo.mockReset();
  });

  it("routes each enabled document or draft shortcut exactly once", () => {
    render(<DocumentHistoryShortcuts />);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });

    expect(history.undo).toHaveBeenCalledOnce();
    expect(history.redo).toHaveBeenCalledTimes(2);
  });

  it("does not consume a shortcut at a truthful history boundary", () => {
    history.canUndo = false;
    history.canRedo = false;
    render(<DocumentHistoryShortcuts />);
    const undo = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "z",
    });

    window.dispatchEvent(undo);

    expect(undo.defaultPrevented).toBe(false);
    expect(history.undo).not.toHaveBeenCalled();
    expect(history.redo).not.toHaveBeenCalled();
  });
});
