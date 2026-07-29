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
    expect(
      screen.getByRole("button", { name: "Restore" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("calls onModeChange when a mode button is clicked", () => {
    const props = renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(props.onModeChange).toHaveBeenCalledWith("add");
  });

  it("calls onBrushSizeChange and exposes no ambiguous model-restore mode", () => {
    const props = renderToolbar();

    fireEvent.change(screen.getByLabelText("Brush size"), { target: { value: "40" } });

    expect(props.onBrushSizeChange).toHaveBeenCalledWith(40);
    expect(screen.queryByLabelText("Brush hardness")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /model/i })).toHaveLength(0);
  });

  it("caps the brush at a 150px diameter and exposes the current diameter", () => {
    renderToolbar({ brushSize: 75 });

    const size = screen.getByLabelText("Brush size");
    expect(size).toHaveProperty("max", "75");
    expect(size.getAttribute("aria-valuetext")).toBe("100%");
    expect(screen.queryByText(/150 px/i)).toBeNull();
  });

  it("keeps draft history controls out of the visible rail", () => {
    renderToolbar();

    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear draft" })).toBeNull();
    expect(screen.getByTestId("manual-cutout-status-slot")).toBeDefined();
  });
});
