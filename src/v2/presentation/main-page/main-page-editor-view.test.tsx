import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MainPageEditorProjection } from "./main-page-editor-contract";
import { MainPageEditorView } from "./main-page-editor-view";

afterEach(cleanup);

function projection(
  overrides: Partial<MainPageEditorProjection> = {},
): MainPageEditorProjection {
  return {
    admissionError: null,
    canRedoDocument: false,
    canUndoDocument: false,
    committedResultUrl: null,
    exportError: null,
    exportSize: "original",
    exportStatus: "idle",
    fallbackUsed: false,
    height: null,
    inferencePath: "wasm",
    locale: "en",
    phase: "empty",
    progressPercent: null,
    qualityMode: "isnet-q8",
    retryable: false,
    restoreFocusTool: null,
    revision: 0,
    sourcePreviewUrl: null,
    width: null,
    ...overrides,
  };
}

describe("MainPageEditorView", () => {
  it("routes single-file admission through the intent boundary", () => {
    const onIntent = vi.fn();
    render(<MainPageEditorView projection={projection()} onIntent={onIntent} />);
    const file = new File([new Uint8Array([1])], "photo.png", {
      type: "image/png",
    });

    fireEvent.change(screen.getByLabelText(/Upload an image|Загрузить изображения/), {
      target: { files: [file] },
    });

    expect(onIntent).toHaveBeenCalledWith({ type: "choose-files", files: [file] });
    expect(screen.getByText(/up to 20 MB|до 20 МБ/)).toBeTruthy();
  });

  it("renders projected dimensions immediately and routes result actions", () => {
    const onIntent = vi.fn();
    render(
      <MainPageEditorView
        projection={projection({
          canUndoDocument: true,
          committedResultUrl: "blob:result",
          height: 600,
          phase: "result",
          revision: 3,
          sourcePreviewUrl: "blob:source",
          width: 800,
        })}
        onIntent={onIntent}
      />,
    );

    expect(screen.getByTestId("before-after-frame").style.aspectRatio).toBe("800 / 600");
    fireEvent.click(screen.getByRole("button", { name: /Manual cutout|Ручная/ }));
    expect(onIntent).toHaveBeenCalledWith({ type: "begin-manual" });
    fireEvent.click(screen.getByRole("button", { name: /Undo edit|Отменить/ }));
    expect(onIntent).toHaveBeenCalledWith({ type: "undo-document" });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(onIntent).toHaveBeenCalledWith({ type: "undo-document" });
  });

  it("routes the projected document redo shortcut from the result rail", () => {
    const onIntent = vi.fn();
    render(
      <MainPageEditorView
        projection={projection({
          canRedoDocument: true,
          committedResultUrl: "blob:result",
          height: 600,
          phase: "result",
          sourcePreviewUrl: "blob:source",
          width: 800,
        })}
        onIntent={onIntent}
      />,
    );

    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(onIntent).toHaveBeenCalledWith({ type: "redo-document" });
  });

  it("projects export errors and retry without swallowing the intent", () => {
    const onIntent = vi.fn();
    render(
      <MainPageEditorView
        projection={projection({
          committedResultUrl: "blob:result",
          exportError: "resize failed",
          exportStatus: "error",
          height: 600,
          phase: "result",
          sourcePreviewUrl: "blob:source",
          width: 800,
        })}
        onIntent={onIntent}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("resize failed");
    fireEvent.click(screen.getByRole("button", { name: /Try again|Повторить/ }));
    expect(onIntent).toHaveBeenCalledWith({ type: "download-selected" });
  });

  it("restores focus to the tool launcher named by presentation state", () => {
    const onIntent = vi.fn();
    render(
      <MainPageEditorView
        projection={projection({
          committedResultUrl: "blob:result",
          height: 600,
          phase: "result",
          restoreFocusTool: "magic",
          sourcePreviewUrl: "blob:source",
          width: 800,
        })}
        onIntent={onIntent}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Magic Cutout|Умное/ }),
    );
    expect(onIntent).toHaveBeenCalledWith({ type: "focus-restored" });
  });
});
