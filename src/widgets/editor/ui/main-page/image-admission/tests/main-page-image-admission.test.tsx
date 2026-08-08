import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MainPageImageAdmission } from "../main-page-image-admission";

afterEach(cleanup);

describe("MainPageImageAdmission", () => {
  it.each([
    ["unsupported-file", /unsupported/i],
    ["exceeds-size-limit", /too large/i],
    ["multiple-files", /one image/i],
    ["invalid-image", /could not be read/i],
  ] as const)("renders the %s validation error and resets", (error, message) => {
    const onRetry = vi.fn();
    render(
      <MainPageImageAdmission
        error={error}
        onCancel={vi.fn()}
        onChooseFiles={vi.fn()}
        onChooseQualityMode={vi.fn()}
        onRetry={onRetry}
        phase="error"
        qualityMode="isnet-q8"
      />,
    );

    expect(screen.getByRole("alert").textContent).toMatch(message);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps preparation and cancellation inside the admission surface", () => {
    const onCancel = vi.fn();
    render(
      <MainPageImageAdmission
        error={null}
        onCancel={onCancel}
        onChooseFiles={vi.fn()}
        onChooseQualityMode={vi.fn()}
        onRetry={vi.fn()}
        phase="preparing"
        qualityMode="isnet-q8"
      />,
    );

    expect(screen.getByRole("status").getAttribute("data-file-admission-state")).toBe(
      "preparing",
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel|Отмена/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
