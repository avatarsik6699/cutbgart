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

  it("renders workspace utilities without an editor group and keeps Back first", () => {
    const onBack = vi.fn();
    render(
      <EditorToolbar
        workspaceActionsSlot={<button type="button">Add images</button>}
        downloadSlot={<button type="button">Download all</button>}
        onBack={onBack}
      />,
    );

    expect(screen.queryByRole("button", { name: /cutout/i })).toBeNull();
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Back to upload");
    fireEvent.click(buttons[0]!);
    expect(onBack).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });
});
