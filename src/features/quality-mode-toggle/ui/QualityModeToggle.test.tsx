import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QualityModeToggle } from "./QualityModeToggle";

afterEach(cleanup);

describe("processing mode selector", () => {
  it("shows three public modes without primary implementation details", () => {
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("Fast")).toBeDefined();
    expect(screen.getByText("Optimal")).toBeDefined();
    expect(screen.getByText("Maximum quality")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getByText("Recommended")).toBeDefined();
    expect(screen.queryByText(/IS-Net|BEN2|WebGPU|WASM|MB|MiB/i)).toBeNull();
  });

  it("maps Maximum quality to the BEN2 internal profile", () => {
    const onChange = vi.fn();
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Maximum quality/ }));

    expect(onChange).toHaveBeenCalledWith("ben2-fp16");
  });

  it("keeps recommendation and Beta badges in the title row", () => {
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={vi.fn()} />);

    for (const badge of [screen.getByText("Recommended"), screen.getByText("Beta")]) {
      const titleRow = badge.parentElement?.parentElement;
      expect(titleRow?.className).toContain("grid-cols-[minmax(0,1fr)_auto]");
      expect(titleRow?.className).toContain("gap-2");
      expect(badge.parentElement?.className).toContain("shrink-0");
    }
    expect(
      screen
        .getAllByRole("radio")
        .every((radio) => Boolean(radio.parentElement?.querySelector("svg"))),
    ).toBe(true);
  });

  it("opens and closes accessible maximum-quality help by click", async () => {
    render(<QualityModeToggle qualityMode="isnet-fp32" onQualityModeChange={vi.fn()} />);

    const trigger = screen.getByRole("button", {
      name: /about maximum quality/i,
    });
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByText(/compatible WebGPU/i)).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => expect(screen.queryByText(/compatible WebGPU/i)).toBeNull());

    fireEvent.blur(trigger);
    fireEvent.focus(trigger);
    await waitFor(() => expect(screen.getByText(/compatible WebGPU/i)).toBeDefined());
  });
});
