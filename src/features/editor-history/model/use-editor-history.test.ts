import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createEditDocumentScope } from "../../../entities/edit-document";
import type { ProcessedImage } from "../../../entities/processed-image";
import { useEditorHistory } from "./use-editor-history";

const source = {
  blob: new Blob(["source"], { type: "image/png" }),
  width: 1,
  height: 1,
  format: "image/png" as const,
};
const image = (value: string): ProcessedImage => ({
  source,
  result: new Blob([value]),
  qualityMode: "isnet-q8",
  alphaMatte: { width: 1, height: 1, data: new Uint8ClampedArray([255]) },
  backgroundFill: { type: "transparent" },
});

describe("useEditorHistory", () => {
  it("exposes stable localized selectors for commit/undo/redo", () => {
    const { result } = renderHook(() =>
      useEditorHistory(createEditDocumentScope(image("base")), "en"),
    );
    act(() =>
      result.current.commit(image("next"), {
        kind: "manual",
        label: "Manual",
      }),
    );
    expect(result.current).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoLabel: "Undo: Manual",
    });
    act(() => result.current.undo());
    expect(result.current).toMatchObject({
      canUndo: false,
      canRedo: true,
      redoLabel: "Redo: Manual",
    });
  });
});
