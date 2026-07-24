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
    expect(screen.getByText(/27\.5 MB/)).toBeDefined();
    expect(screen.getByText(/104 MB/)).toBeDefined();
    fireEvent.click(screen.getByRole("radio", { name: /maximum/i }));
    expect(onModeChange).toHaveBeenCalledWith("maximum");
  });
});
