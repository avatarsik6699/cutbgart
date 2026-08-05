import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToolPanelSlot } from "./tool-panel-slot";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ToolPanelSlot", () => {
  it("defers automatic focus until the next animation frame", () => {
    let focusFrame: FrameRequestCallback | undefined;
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        focusFrame = callback;
        return 42;
      });
    const view = render(
      <ToolPanelSlot toolId="enhance" label="Enhancements" autoFocus>
        Controls
      </ToolPanelSlot>,
    );
    const panel = view.getByRole("region", { name: "Enhancements" });

    expect(requestFrame).toHaveBeenCalledOnce();
    expect(document.activeElement).not.toBe(panel);
    act(() => focusFrame?.(0));
    expect(document.activeElement).toBe(panel);
  });

  it("cancels pending focus when the panel unmounts", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(73);
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const view = render(
      <ToolPanelSlot toolId="enhance" label="Enhancements" autoFocus>
        Controls
      </ToolPanelSlot>,
    );

    view.unmount();
    expect(cancelFrame).toHaveBeenCalledWith(73);
  });
});
