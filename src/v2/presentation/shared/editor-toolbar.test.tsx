import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorToolRegistry } from "./editor-tool-registry";
import { EditorToolbar } from "./editor-toolbar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it("observes scroll boundaries without synchronously measuring layout", () => {
    let observerCallback: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const constructObserver = vi.fn();
    class IntersectionObserverMock {
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        observerCallback = callback;
        constructObserver(callback, options);
      }

      disconnect = disconnect;
      observe = observe;
      takeRecords = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    const view = render(
      <EditorToolbar
        tools={createEditorToolRegistry()}
        activeTool="cutout"
        onToolChange={vi.fn()}
      />,
    );
    const toolbar = screen.getByRole("toolbar");
    const leftBoundary = view.container.querySelector('[data-scroll-boundary="left"]');
    const rightBoundary = view.container.querySelector('[data-scroll-boundary="right"]');
    const leftFade = view.container.querySelector('[data-scroll-fade="left"]');
    const rightFade = view.container.querySelector('[data-scroll-fade="right"]');

    expect(constructObserver).toHaveBeenCalledWith(expect.any(Function), {
      root: toolbar,
      rootMargin: "0px -4px",
      threshold: 1,
    });
    expect(observe).toHaveBeenCalledWith(leftBoundary);
    expect(observe).toHaveBeenCalledWith(rightBoundary);

    act(() => {
      observerCallback?.(
        [
          { isIntersecting: false, target: leftBoundary },
          { isIntersecting: true, target: rightBoundary },
        ] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });

    expect(leftFade?.classList.contains("opacity-100")).toBe(true);
    expect(rightFade?.classList.contains("opacity-0")).toBe(true);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
