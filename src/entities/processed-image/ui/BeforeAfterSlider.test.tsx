import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SourceImage } from "../model/types";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

const before: SourceImage = {
  blob: new Blob(["before"], { type: "image/jpeg" }),
  width: 800,
  height: 600,
  format: "image/jpeg",
};
const after = new Blob(["after"], { type: "image/png" });

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("BeforeAfterSlider", () => {
  it.each([
    [400, 800, "400 / 800"],
    [800, 400, "800 / 400"],
    [600, 600, "600 / 600"],
  ])("uses contain geometry for a %sx%s source", (width, height, aspectRatio) => {
    render(<BeforeAfterSlider before={{ ...before, width, height }} after={after} />);

    const frame = screen.getByTestId("before-after-frame");
    expect(frame.style.aspectRatio).toBe(aspectRatio);
    expect(frame.getAttribute("data-fit")).toBe("contain");
    expect(screen.getAllByRole("img")[0]?.className).toContain("object-contain");
  });

  it("renders the before image and an accessible slider handle at the midpoint", () => {
    render(<BeforeAfterSlider before={before} after={after} />);

    expect(screen.getByAltText(/before and after/i)).toBeDefined();
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuenow")).toBe("50");
  });

  it("moves the slider with the arrow keys", () => {
    render(<BeforeAfterSlider before={before} after={after} />);

    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(slider.getAttribute("aria-valuenow")).toBe("55");
  });

  it("jumps to the edges with Home/End", () => {
    render(<BeforeAfterSlider before={before} after={after} />);

    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider.getAttribute("aria-valuenow")).toBe("100");

    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider.getAttribute("aria-valuenow")).toBe("0");
  });

  it("previews a selected fill behind the transparent cutout", () => {
    render(
      <BeforeAfterSlider
        before={before}
        after={after}
        backgroundFill={{ type: "color", value: "#123456" }}
      />,
    );

    const background = screen.getByTestId("after-preview-background");
    expect(background.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(background.style.backgroundImage).toBe("none");
    expect(background.className).not.toContain("transparency-grid");
  });

  it("shows the checkerboard only for a transparent fill", () => {
    render(<BeforeAfterSlider before={before} after={after} />);

    expect(screen.getByTestId("after-preview-background").className).toContain(
      "transparency-grid",
    );
  });

  it("supports a document-owned comparison position", () => {
    const onPositionChange = vi.fn();
    render(
      <BeforeAfterSlider
        before={before}
        after={after}
        position={65}
        onPositionChange={onPositionChange}
      />,
    );

    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuenow")).toBe("65");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onPositionChange).toHaveBeenCalledWith(70);
  });
});
