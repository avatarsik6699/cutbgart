import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CutoutToolPanel } from "./CutoutToolPanel";

afterEach(cleanup);

describe("CutoutToolPanel", () => {
  it("maps one persistent panel to Magic and Manual without parallel documents", () => {
    const onModeChange = vi.fn();
    const { rerender } = render(
      <CutoutToolPanel
        mode="magic"
        onModeChange={onModeChange}
        magicControls={<span>Keep / Remove controls</span>}
        manualControls={<span>Restore / Erase controls</span>}
      />,
    );
    expect(screen.getByRole("tab", { name: "Magic" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByText("Keep / Remove controls")).toBeDefined();

    fireEvent.click(screen.getByRole("tab", { name: "Manual" }));
    expect(onModeChange).toHaveBeenCalledWith("manual");
    rerender(
      <CutoutToolPanel
        mode="manual"
        onModeChange={onModeChange}
        magicControls={<span>Keep / Remove controls</span>}
        manualControls={<span>Restore / Erase controls</span>}
      />,
    );
    expect(screen.getByText("Restore / Erase controls")).toBeDefined();
    expect(screen.getByText("Keep / Remove controls").closest("[hidden]")).not.toBeNull();
  });
});
