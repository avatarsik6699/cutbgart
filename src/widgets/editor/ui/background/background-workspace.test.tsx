import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createBackgroundDraftId,
  createDocumentId,
  type BackgroundTypes,
} from "@/editor/domain";
import { BackgroundWorkspace, type BackgroundInteraction } from "./background-workspace";

afterEach(cleanup);

const draft: BackgroundTypes.Draft = {
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
        originalUrl="blob:original"
        resultUrl="blob:result"
        runtime={{ status: "ready", previewUrl: null, error: null }}
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
    expect(screen.getByTestId("before-after-frame").dataset.toolImageViewport).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /^Apply$|^Применить$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));
    expect(harness.calls.apply).toHaveBeenCalledOnce();
    expect(harness.calls.cancel).toHaveBeenCalledOnce();
  });

  it("renders a selected preset immediately over the committed foreground", () => {
    const harness = sessionHarness();
    render(
      <BackgroundWorkspace
        draft={{
          ...draft,
          draftRevision: 1,
          dirty: true,
          fill: {
            type: "gradient",
            kind: "linear",
            stops: [
              { offset: 0, color: "#00C6FF" },
              { offset: 1, color: "#0072FF" },
            ],
          },
        }}
        foregroundUrl="blob:committed-foreground"
        height={100}
        originalUrl="blob:original"
        resultUrl="blob:committed-result"
        runtime={{ status: "ready", previewUrl: null, error: null }}
        interaction={harness.interaction}
        width={100}
      />,
    );

    const preview = screen.getByTestId("after-preview-background");
    expect(preview.style.backgroundImage).toContain("linear-gradient");
    expect(preview.querySelector("img")?.getAttribute("src")).toBe(
      "blob:committed-foreground",
    );
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:original");
  });

  it("announces preparation errors and prevents committing them", () => {
    const harness = sessionHarness();
    render(
      <BackgroundWorkspace
        draft={{ ...draft, dirty: true }}
        foregroundUrl="blob:foreground"
        height={100}
        originalUrl="blob:original"
        resultUrl="blob:result"
        runtime={{ status: "error", previewUrl: null, error: "too-large" }}
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

  it("blocks the stage while Apply is in flight", () => {
    const harness = sessionHarness();
    render(
      <BackgroundWorkspace
        draft={{ ...draft, dirty: true, status: "applying" }}
        foregroundUrl="blob:foreground"
        height={100}
        originalUrl="blob:original"
        resultUrl="blob:result"
        runtime={{ status: "ready", previewUrl: null, error: null }}
        interaction={harness.interaction}
        width={100}
      />,
    );

    expect(screen.getByTestId("editor-stage-placeholder").textContent).toMatch(
      /Applying the background|Применяем фон/,
    );
  });
});
