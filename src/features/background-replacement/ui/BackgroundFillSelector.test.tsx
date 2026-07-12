import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BackgroundFill, ProcessedImage } from "../../../entities/processed-image";
import { BackgroundFillSelector } from "./BackgroundFillSelector";

const image: ProcessedImage = {
  source: { blob: new Blob(), width: 10, height: 10, format: "image/png" },
  result: new Blob(),
  qualityMode: "fast",
  backgroundFill: { type: "transparent" },
};

afterEach(() => cleanup());

function renderSelector(onPreview = vi.fn()) {
  return render(
    <BackgroundFillSelector
      image={image}
      onPreview={onPreview}
      onApply={vi.fn().mockResolvedValue(image)}
      onResult={vi.fn()}
    />,
  );
}

describe("BackgroundFillSelector", () => {
  it("shows keyboard controls and eight circular fill swatches", () => {
    renderSelector();
    expect(
      screen.getByRole("button", { name: "Transparent" }).getAttribute("aria-pressed"),
    ).toBe("true");
    for (const name of ["Sunset", "Ocean", "Mint", "Spotlight", "Peach", "Night"]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
    expect(screen.getAllByTestId("fill-swatch")).toHaveLength(8);
    expect(screen.getByLabelText("Background color")).toBeDefined();
    expect(screen.getByLabelText("Custom background image")).toBeDefined();
  });

  it("keeps the inline picker open while previewing continuous changes", () => {
    const onPreview = vi.fn();
    renderSelector(onPreview);

    fireEvent.click(screen.getByRole("button", { name: "Background color" }));
    const palette = screen.getByRole("slider", {
      name: "Color saturation and brightness",
    });
    fireEvent.keyDown(palette, { key: "ArrowRight" });

    expect(palette.isConnected).toBe(true);
    expect(onPreview).toHaveBeenLastCalledWith({ type: "color", value: "#FFFCFC" });

    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ type: "gradient", kind: "linear" }),
    );
  });

  it("never encodes while previewing — Save only runs onApply once, on click", async () => {
    const onApply = vi
      .fn()
      .mockImplementation((fill: BackgroundFill) =>
        Promise.resolve({ ...image, backgroundFill: fill }),
      );
    render(
      <BackgroundFillSelector
        image={image}
        onPreview={vi.fn()}
        onApply={onApply}
        onResult={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole<HTMLButtonElement>("button", {
      name: "Save background",
    });
    expect(saveButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    fireEvent.click(screen.getByRole("button", { name: "Mint" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(saveButton.disabled).toBe(false);

    fireEvent.click(saveButton);
    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ type: "gradient", kind: "linear" }),
    );
    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });
  });
});
