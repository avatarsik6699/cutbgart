import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QualityModeToggle } from "./QualityModeToggle";

afterEach(cleanup);

describe("processing mode selector", () => {
  it("shows truthful metadata for all production modes", () => {
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText(/≈44 MB/)).toBeDefined();
    expect(screen.getByText(/≈176 MB/)).toBeDefined();
    expect(screen.getByText(/≈219 MB/)).toBeDefined();
    expect(screen.getByText(/High memory use/)).toBeDefined();
  });

  it("selects BEN2 explicitly", () => {
    const onChange = vi.fn();
    render(<QualityModeToggle qualityMode="isnet-q8" onQualityModeChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /BEN2 Fine detail/ }));
    expect(onChange).toHaveBeenCalledWith("ben2-fp16");
  });
});
