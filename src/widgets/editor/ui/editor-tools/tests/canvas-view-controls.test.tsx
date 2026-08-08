import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasViewControls } from "../canvas-view-controls";

afterEach(cleanup);

describe("CanvasViewControls", () => {
  it("exposes hand mode and the shared zoom actions over the canvas", () => {
    const onInteractionModeChange = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onResetView = vi.fn();
    const onToggleFullscreen = vi.fn();
    const onCollapsedChange = vi.fn();

    render(
      <CanvasViewControls
        interactionMode="brush"
        onInteractionModeChange={onInteractionModeChange}
        zoomPercent={125}
        canZoomIn
        canZoomOut
        canPan
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetView={onResetView}
        expanded={false}
        onToggleFullscreen={onToggleFullscreen}
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
        shortcutsActive
      />,
    );

    expect(screen.getByTestId("canvas-view-controls").className).toContain("absolute");
    expect(screen.getByLabelText("Zoom 125%")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /pan image/i }));
    fireEvent.click(screen.getByRole("button", { name: /zoom out/i }));
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /fit image/i }));
    fireEvent.click(screen.getByRole("button", { name: /fullscreen/i }));
    fireEvent.click(screen.getByRole("button", { name: /collapse view controls/i }));
    fireEvent.keyDown(window, { key: "h" });
    fireEvent.keyDown(window, { key: "b" });
    fireEvent.keyDown(window, { key: "f" });
    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    fireEvent.keyDown(window, { key: "-", ctrlKey: true });
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });

    expect(onInteractionModeChange).toHaveBeenCalledWith("hand");
    expect(onZoomOut).toHaveBeenCalledTimes(2);
    expect(onZoomIn).toHaveBeenCalledTimes(2);
    expect(onResetView).toHaveBeenCalledTimes(2);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(2);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(onInteractionModeChange).toHaveBeenCalledWith("hand");
    expect(onInteractionModeChange).toHaveBeenCalledWith("brush");
  });

  it("expands from a single compact action", () => {
    const onCollapsedChange = vi.fn();
    render(
      <CanvasViewControls
        interactionMode="brush"
        onInteractionModeChange={vi.fn()}
        zoomPercent={100}
        canZoomIn
        canZoomOut={false}
        canPan={false}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetView={vi.fn()}
        expanded={false}
        onToggleFullscreen={vi.fn()}
        collapsed
        onCollapsedChange={onCollapsedChange}
        shortcutsActive={false}
      />,
    );

    expect(screen.getByTestId("canvas-view-controls").dataset.collapsed).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /expand view controls/i }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
