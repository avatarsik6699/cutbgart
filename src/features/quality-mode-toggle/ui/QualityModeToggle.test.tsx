import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QualityModeToggle } from "./QualityModeToggle";

afterEach(() => {
  cleanup();
});

describe("QualityModeToggle", () => {
  it("reflects the 'fast' quality mode as unchecked", () => {
    render(<QualityModeToggle qualityMode="fast" onQualityModeChange={vi.fn()} />);

    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Fast")).toBeDefined();
  });

  it("reflects the 'max' quality mode as checked", () => {
    render(<QualityModeToggle qualityMode="max" onQualityModeChange={vi.fn()} />);

    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Max quality")).toBeDefined();
  });

  it("calls onQualityModeChange with 'max' when toggled on from 'fast'", () => {
    const onQualityModeChange = vi.fn();
    render(
      <QualityModeToggle qualityMode="fast" onQualityModeChange={onQualityModeChange} />,
    );

    fireEvent.click(screen.getByRole("switch"));

    expect(onQualityModeChange).toHaveBeenCalledWith("max");
  });

  it("calls onQualityModeChange with 'fast' when toggled off from 'max'", () => {
    const onQualityModeChange = vi.fn();
    render(
      <QualityModeToggle qualityMode="max" onQualityModeChange={onQualityModeChange} />,
    );

    fireEvent.click(screen.getByRole("switch"));

    expect(onQualityModeChange).toHaveBeenCalledWith("fast");
  });
});
