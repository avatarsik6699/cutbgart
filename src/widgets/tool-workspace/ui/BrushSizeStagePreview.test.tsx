import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sourcePixelsToViewportPixels } from "@/shared/lib/brush-geometry";
import { BrushSizeStagePreview } from "./BrushSizeStagePreview";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BrushSizeStagePreview", () => {
  it("uses the exact source-to-viewport conversion across aspect ratios and zoom", () => {
    expect(sourcePixelsToViewportPixels(40, 400, 800)).toBe(20);
    expect(sourcePixelsToViewportPixels(40, 800, 800)).toBe(40);
    expect(sourcePixelsToViewportPixels(40, 300, 1200)).toBe(10);
    expect(sourcePixelsToViewportPixels(40, 0, 800)).toBe(0);
  });

  it("appears stage-centred after slider interaction and hides shortly after", async () => {
    vi.useFakeTimers();
    const target = document.createElement("canvas");
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 600,
      bottom: 300,
      width: 600,
      height: 300,
      toJSON: () => ({}),
    });
    render(
      <div className="relative">
        <BrushSizeStagePreview
          sourceDiameter={80}
          sourceWidth={1200}
          targetRef={{ current: target }}
          interactionKey={1}
          tone="restore"
        />
      </div>,
    );
    const preview = screen.getByTestId("brush-size-stage-preview");
    expect(preview.getAttribute("data-visible")).toBe("true");
    expect(Number(preview.getAttribute("data-viewport-diameter"))).toBe(40);
    expect(preview.className).toMatch(/place-items-center/);
    expect(
      screen
        .getByTestId("brush-size-stage-preview-ring")
        .querySelector("circle")
        ?.getAttribute("stroke-dasharray"),
    ).toBe("3 2");
    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    expect(preview.getAttribute("data-visible")).toBe("false");
  });
});
