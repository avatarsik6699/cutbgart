import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessedImage } from "../../../entities/processed-image";
import { BackgroundToolPanel } from "./BackgroundToolPanel";

const image: ProcessedImage = {
  source: {
    blob: new Blob(["source"], { type: "image/png" }),
    width: 1200,
    height: 800,
    format: "image/png",
  },
  result: new Blob(["committed"], { type: "image/png" }),
  qualityMode: "isnet-q8",
  backgroundFill: { type: "color", value: "#112233" },
};

afterEach(cleanup);

describe("BackgroundToolPanel", () => {
  it("opens from the committed fill and reports draft state independently", () => {
    const onDirtyChange = vi.fn();
    const onPreview = vi.fn();
    render(
      <BackgroundToolPanel
        image={image}
        onPreview={onPreview}
        onApply={vi.fn().mockResolvedValue(image)}
        onResult={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Background color" })
        .getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ type: "gradient", kind: "linear" }),
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onPreview).toHaveBeenLastCalledWith({
      type: "color",
      value: "#112233",
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
