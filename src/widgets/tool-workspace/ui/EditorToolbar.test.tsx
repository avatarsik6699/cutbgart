import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorToolRegistry } from "../model/editor-tool-registry";
import { EditorToolbar } from "./EditorToolbar";

afterEach(cleanup);

describe("EditorToolbar", () => {
  it("renders registry order and supports roving arrow-key focus", () => {
    render(
      <EditorToolbar
        tools={createEditorToolRegistry()}
        activeTool="cutout"
        onToolChange={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    );
    const toolbar = screen.getByRole("toolbar");
    const cutout = screen.getByRole("button", { name: /cutout/i });
    const enhance = screen.getByRole("button", { name: /enhancements/i });

    cutout.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowRight" });

    expect(document.activeElement).toBe(enhance);
    expect(cutout.getAttribute("tabindex")).toBe("0");
    expect(enhance.getAttribute("tabindex")).toBe("-1");
  });

  it("exposes labeled history icon controls", () => {
    const undo = vi.fn();
    render(
      <EditorToolbar
        tools={createEditorToolRegistry()}
        activeTool="cutout"
        onToolChange={vi.fn()}
        canUndo
        canRedo={false}
        undoLabel="Undo: Background"
        onUndo={undo}
        onRedo={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo: Background" }));
    expect(undo).toHaveBeenCalledOnce();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /redo/i }).disabled,
    ).toBe(true);
  });
});
