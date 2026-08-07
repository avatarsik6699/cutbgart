import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QualityModePopover } from "../ui/quality-mode-popover";

afterEach(cleanup);

describe("QualityModePopover", () => {
  it("applies a mode and closes before another top-bar action is used", async () => {
    const onQualityModeChange = vi.fn();
    render(
      <QualityModePopover
        qualityMode="isnet-q8"
        onQualityModeChange={onQualityModeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fast" }));
    fireEvent.click(screen.getByRole("radio", { name: /^Optimal/i }));
    expect(onQualityModeChange).toHaveBeenCalledWith("isnet-fp32");
    await waitFor(() =>
      expect(screen.queryByRole("radio", { name: /^Optimal/i })).toBeNull(),
    );
  });
});
