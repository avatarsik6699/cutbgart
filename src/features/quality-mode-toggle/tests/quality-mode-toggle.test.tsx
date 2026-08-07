import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QualityModeToggle } from "../ui/quality-mode-selector";

afterEach(cleanup);

describe("processing mode selector", () => {
  it("shows three public modes without primary implementation details", () => {
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("Fast")).toBeDefined();
    expect(screen.getByText("Optimal")).toBeDefined();
    expect(screen.getByText("Maximum")).toBeDefined();
    expect(screen.queryByText(/IS-Net|BEN2|WASM/i)).toBeNull();
  });

  it("maps Maximum quality to the BEN2 internal profile", () => {
    const onChange = vi.fn();
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Maximum/ }));
    expect(onChange).toHaveBeenCalledWith("ben2-fp16");
  });

  it("retains the Maximum emphasis without Beta or Recommended badges", () => {
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={vi.fn()} />);

    expect(screen.queryByText("Beta")).toBeNull();
    expect(screen.queryByText("Recommended")).toBeNull();
    const maximumRadio = screen.getByRole("radio", { name: /Maximum/ });
    expect(maximumRadio.closest(".group")?.className).toContain("quality-mode-shimmer");
  });

  it("keeps the Maximum help accessible by click and focus", async () => {
    render(<QualityModeToggle qualityMode="isnet-fp32" onQualityModeChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /about maximum quality/i });

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByText(/precise model on WebGPU/i)).toBeDefined(),
    );
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() =>
      expect(screen.queryByText(/precise model on WebGPU/i)).toBeNull(),
    );
    fireEvent.blur(trigger);
    fireEvent.focus(trigger);
    await waitFor(() =>
      expect(screen.getByText(/precise model on WebGPU/i)).toBeDefined(),
    );
  });
});
