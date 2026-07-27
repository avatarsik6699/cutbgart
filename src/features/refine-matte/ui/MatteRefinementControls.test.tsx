import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MatteRefinementControls } from "./MatteRefinementControls";

describe("MatteRefinementControls", () => {
  it("discloses both downloads before start and recommends by capability", () => {
    const onModeChange = vi.fn();
    render(
      <MatteRefinementControls
        mode="balanced"
        path="webgpu"
        status="idle"
        progress={null}
        fallbackReason={null}
        fallback={null}
        onModeChange={onModeChange}
        onStart={vi.fn()}
        onCancel={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(/practical default/i)).toBeDefined();
    expect(screen.getByText(/finest soft edges/i)).toBeDefined();
    expect(screen.queryByText(/MB|MiB|WebGPU|WASM/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /maximum/i }));
    expect(onModeChange).toHaveBeenCalledWith("maximum");
  });
});
