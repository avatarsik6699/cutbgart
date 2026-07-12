import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaskCorrectionToolbar } from "./MaskCorrectionToolbar";

afterEach(() => {
  cleanup();
});

function renderToolbar(
  overrides: Partial<Parameters<typeof MaskCorrectionToolbar>[0]> = {},
) {
  const props = {
    mode: "add" as const,
    onModeChange: vi.fn(),
    brushSize: 24,
    onBrushSizeChange: vi.fn(),
    brushHardness: 0.5,
    onBrushHardnessChange: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    zoomPercent: 100,
    canZoomIn: true,
    canZoomOut: false,
    canPan: false,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onResetView: vi.fn(),
    ...overrides,
  };
  render(<MaskCorrectionToolbar {...props} />);
  return props;
}

describe("MaskCorrectionToolbar", () => {
  it("marks the active mode button as pressed", () => {
    renderToolbar({ mode: "erase" });

    expect(
      screen.getByRole("button", { name: "Erase" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Add" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("calls onModeChange when a mode button is clicked", () => {
    const props = renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(props.onModeChange).toHaveBeenCalledWith("restore");
  });

  it("calls onBrushSizeChange/onBrushHardnessChange from the range inputs", () => {
    const props = renderToolbar();

    fireEvent.change(screen.getByLabelText("Brush size"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Brush hardness"), {
      target: { value: "0.8" },
    });

    expect(props.onBrushSizeChange).toHaveBeenCalledWith(40);
    expect(props.onBrushHardnessChange).toHaveBeenCalledWith(0.8);
  });

  it("caps the brush at a 150px diameter and exposes the current diameter", () => {
    renderToolbar({ brushSize: 75 });

    const size = screen.getByLabelText("Brush size");
    expect(size).toHaveProperty("max", "75");
    expect(size.getAttribute("aria-valuetext")).toBe("150 px diameter");
    expect(screen.getByText("150 px")).toBeDefined();
  });

  it("disables undo/redo buttons when there's no history, and enables them otherwise", () => {
    renderToolbar({ canUndo: false, canRedo: true });

    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Redo" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("calls onUndo/onRedo when clicked", () => {
    const props = renderToolbar({ canUndo: true, canRedo: true });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));

    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onRedo).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Undo" }).getAttribute("aria-keyshortcuts"),
    ).toBe("Control+Z Meta+Z");
    expect(
      screen.getByRole("button", { name: "Redo" }).getAttribute("aria-keyshortcuts"),
    ).toContain("Control+Y");
  });

  it("calls zoom controls and exposes the current zoom level", () => {
    const props = renderToolbar({
      zoomPercent: 125,
      canZoomOut: true,
    });

    expect(screen.getByText("125%")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));

    expect(props.onZoomIn).toHaveBeenCalledWith();
    expect(props.onZoomOut).toHaveBeenCalledWith();
    expect(props.onResetView).toHaveBeenCalledTimes(1);
  });

  it("enables reset when the view is panned even at 100% zoom", () => {
    renderToolbar({ zoomPercent: 100, canPan: true });

    expect(screen.getByRole("button", { name: "Reset view" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByLabelText("Zoom 100%, panned")).toBeDefined();
  });
});
