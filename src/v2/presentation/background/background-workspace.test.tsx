import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createBackgroundDraftId,
  createDocumentId,
  type BackgroundDraft,
} from "@/v2/domain";
import { BackgroundWorkspace, type BackgroundInteraction } from "./background-workspace";

afterEach(cleanup);

const draft: BackgroundDraft = {
  kind: "background",
  draftId: createBackgroundDraftId("background-draft-1"),
  documentId: createDocumentId("document-1"),
  baselineRevision: 1,
  draftRevision: 0,
  fill: { type: "transparent" },
  dirty: false,
  status: "ready",
};

function sessionHarness() {
  const calls = {
    apply: vi.fn(),
    cancel: vi.fn(),
    change: vi.fn(),
    selectImage: vi.fn(),
  };
  return {
    calls,
    interaction: {
      apply: calls.apply,
      cancel: calls.cancel,
      change: calls.change,
      selectImage: calls.selectImage,
    } satisfies BackgroundInteraction,
  };
}

describe("BackgroundWorkspace", () => {
  it("keeps preview choices local until explicit Apply and exposes image limits", () => {
    const harness = sessionHarness();
    render(
      <BackgroundWorkspace
        draft={{ ...draft, dirty: true }}
        foregroundUrl="blob:foreground"
        height={100}
        runtime={{ status: "ready", previewUrl: null, error: null }}
        sourceUrl="blob:source"
        interaction={harness.interaction}
        width={100}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ocean|Океан/ }));
    expect(harness.calls.change).toHaveBeenCalledWith({
      type: "gradient",
      kind: "linear",
      stops: [
        { offset: 0, color: "#00C6FF" },
        { offset: 1, color: "#0072FF" },
      ],
    });

    const input = screen.getByLabelText(
      /Choose background image|Выбрать изображение для фона/,
    );
    const file = new File([new Uint8Array([1])], "background.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(harness.calls.selectImage).toHaveBeenCalledWith(file);
    expect(screen.getByText(/20 MiB|20 МиБ/)).toBeDefined();
    expect(screen.getByText(/Download always|Скачивание всегда/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Apply$|^Применить$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));
    expect(harness.calls.apply).toHaveBeenCalledOnce();
    expect(harness.calls.cancel).toHaveBeenCalledOnce();
  });

  it("announces preparation errors and prevents committing them", () => {
    const harness = sessionHarness();
    render(
      <BackgroundWorkspace
        draft={{ ...draft, dirty: true }}
        foregroundUrl="blob:foreground"
        height={100}
        runtime={{ status: "error", previewUrl: null, error: "too-large" }}
        sourceUrl="blob:source"
        interaction={harness.interaction}
        width={100}
      />,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: /^Apply$|^Применить$/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
