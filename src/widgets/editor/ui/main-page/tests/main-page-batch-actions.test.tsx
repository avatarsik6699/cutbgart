import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MainPageBatchActions } from "../main-page-batch-actions";

afterEach(cleanup);

describe("MainPageBatchActions", () => {
  it("groups the mode with admission for subsequently added images", () => {
    render(
      <MainPageBatchActions
        actions={{ atCapacity: false, completedCount: 0, exporting: false }}
        disabled={false}
        onAddFiles={vi.fn()}
        onCancelDownloadAll={vi.fn()}
        onChooseQualityMode={vi.fn()}
        onDownloadAll={vi.fn()}
        qualityMode="ben2-fp16"
      />,
    );

    const group = screen.getByRole("group", {
      name: /processing mode and admission for new images/i,
    });
    expect(group.textContent).toMatch(/mode for new images/i);
    expect(group.querySelector("button")?.textContent).toMatch(/maximum/i);
    expect(group.textContent).toMatch(/add images/i);

    fireEvent.click(screen.getByRole("button", { name: "Maximum" }));
    expect(screen.getAllByText("Processing mode")).toHaveLength(1);
  });
});
