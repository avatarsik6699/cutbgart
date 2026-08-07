import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDocumentId } from "@/editor/domain";

import type { EditorToolWorkspaceProjection } from "./editor-tool-workspace-contract";
import { EditorToolWorkspaceView } from "./editor-tool-workspace-view";

afterEach(cleanup);

const projection: EditorToolWorkspaceProjection = {
  locale: "en",
  documentId: createDocumentId("document-1"),
  revision: 3,
  activeTool: "cutout",
  cutoutMode: "magic",
  canUndoDraft: false,
  canRedoDraft: false,
  canUndoDocument: true,
  canRedoDocument: false,
  dirtyDraft: false,
  busy: false,
  sourcePreviewUrl: "blob:source",
  committedResultUrl: "blob:result",
  width: 100,
  height: 100,
  manualDraft: null,
  magicDraft: null,
  backgroundDraft: null,
  enhancementDraft: null,
};

describe("EditorToolWorkspaceView", () => {
  it("renders v1 chrome from immutable projection and emits typed navigation intents", () => {
    const onIntent = vi.fn();
    render(
      <EditorToolWorkspaceView projection={projection} onIntent={onIntent}>
        <div data-testid="tool-content" />
      </EditorToolWorkspaceView>,
    );

    expect(screen.getByTestId("editor-toolbar")).toBeDefined();
    expect(screen.getByText(/Document revision 3|Версия документа: 3/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Background|Фон/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Undo document change|Отменить изменение документа/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Back to upload|К загрузке/ }));

    expect(onIntent).toHaveBeenNthCalledWith(1, {
      type: "choose-tool",
      tool: "background",
    });
    expect(onIntent).toHaveBeenNthCalledWith(2, { type: "undo-document" });
    expect(onIntent).toHaveBeenNthCalledWith(3, { type: "leave-workspace" });
  });

  it("blocks document history while a draft is dirty", () => {
    render(
      <EditorToolWorkspaceView
        projection={{ ...projection, dirtyDraft: true }}
        onIntent={vi.fn()}
      >
        <div />
      </EditorToolWorkspaceView>,
    );

    expect(
      screen
        .getByRole("button", {
          name: /Undo document change|Отменить изменение документа/,
        })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("routes common toolbar history to the active draft", () => {
    const onIntent = vi.fn();
    render(
      <EditorToolWorkspaceView
        projection={{
          ...projection,
          dirtyDraft: true,
          canUndoDraft: true,
          canRedoDraft: true,
        }}
        onIntent={onIntent}
      >
        <div />
      </EditorToolWorkspaceView>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Undo|Отменить/ }));
    fireEvent.click(screen.getByRole("button", { name: /Redo|Повторить/ }));

    expect(onIntent).toHaveBeenNthCalledWith(1, { type: "undo-draft" });
    expect(onIntent).toHaveBeenNthCalledWith(2, { type: "redo-draft" });
  });
});
