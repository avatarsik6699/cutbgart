import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForegroundRefinementControls } from "./ForegroundRefinementControls";

afterEach(cleanup);

describe("ForegroundRefinementControls", () => {
  it("starts with optional component cleanup and supports keyboard toggling", () => {
    const onStart = vi.fn();
    render(
      <ForegroundRefinementControls
        status="idle"
        progress={null}
        fallbackReason={null}
        result={null}
        error={null}
        onStart={onStart}
        onCancel={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const cleanup = screen.getByRole("checkbox", { name: /isolated soft specks/i });
    fireEvent.click(cleanup);
    fireEvent.click(screen.getByRole("button", { name: /clean edge colours/i }));
    expect(onStart).toHaveBeenCalledWith(false);
  });

  it("shows generic fallback copy without exposing the technical reason", () => {
    render(
      <ForegroundRefinementControls
        status="fallback"
        progress={null}
        fallbackReason="private diagnostic detail"
        result={null}
        error={null}
        onStart={vi.fn()}
        onCancel={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(/safe cleanup path/i)).toBeDefined();
    expect(screen.queryByText(/private diagnostic detail/i)).toBeNull();
  });

  it("announces applied, unchanged, and recoverable error outcomes", () => {
    const baseResult = {
      foreground: new Blob(),
      matte: { width: 1, height: 1, data: new Uint8ClampedArray([128]) },
      dirtyPatch: null,
      requestedPath: "decontaminate" as const,
      actualPath: "decontaminate" as const,
      fallback: "none" as const,
      durationMs: 1,
      memoryBytes: "unavailable" as const,
    };
    const { rerender } = render(
      <ForegroundRefinementControls
        status="result"
        progress={null}
        fallbackReason={null}
        result={baseResult}
        error={null}
        onStart={vi.fn()}
        onCancel={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/cleanup was applied/i);

    rerender(
      <ForegroundRefinementControls
        status="result"
        progress={null}
        fallbackReason="hidden reason"
        result={{
          ...baseResult,
          actualPath: "unchanged",
          fallback: "no-soft-edge",
        }}
        error={null}
        onStart={vi.fn()}
        onCancel={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/no safe soft-edge/i);
    expect(screen.queryByText(/hidden reason/i)).toBeNull();

    rerender(
      <ForegroundRefinementControls
        status="error"
        progress={null}
        fallbackReason={null}
        result={null}
        error={{ code: "processing-failed", message: "hidden error", recoverable: true }}
        onStart={vi.fn()}
        onCancel={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/could not be completed/i);
    expect(
      screen.getByRole("button", { name: /retry cleanup/i }).hasAttribute("disabled"),
    ).toBe(false);
    expect(screen.queryByText(/hidden error/i)).toBeNull();
  });
});
