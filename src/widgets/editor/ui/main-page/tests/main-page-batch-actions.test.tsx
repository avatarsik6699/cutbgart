import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MainPageBatchActions } from "../main-page-batch-actions";

afterEach(cleanup);

describe("MainPageBatchActions", () => {
  it("renders a split button pairing model choice with adding new images", () => {
    render(
      <MainPageBatchActions
        actions={{ atCapacity: false }}
        disabled={false}
        onAddFiles={vi.fn()}
        onChooseQualityMode={vi.fn()}
        qualityMode="ben2-fp16"
      />,
    );

    const group = screen.getByRole("group", {
      name: /processing mode and admission for new images/i,
    });
    expect(group.textContent).not.toMatch(/mode for new images/i);
    expect(group.querySelector("button")?.textContent).toMatch(/maximum/i);
    expect(group.textContent).toMatch(/add images/i);
  });

  it("opens the model menu from the trigger and applies the selected model", () => {
    const onChooseQualityMode = vi.fn();
    render(
      <MainPageBatchActions
        actions={{ atCapacity: false }}
        disabled={false}
        onAddFiles={vi.fn()}
        onChooseQualityMode={onChooseQualityMode}
        qualityMode="ben2-fp16"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Automatic removal model" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /fast/i }));

    expect(onChooseQualityMode).toHaveBeenCalledWith("isnet-q8");
  });
});
