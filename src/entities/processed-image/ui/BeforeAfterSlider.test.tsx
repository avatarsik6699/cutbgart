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
});
