import { describe, expect, it } from "vitest";

import { createDocumentId, createWorkspaceItemId } from "@/editor/domain";

import type { MainPageEditorTypes } from "../main-page-editor.types";
import { batchMainPageProjectionEqual } from "../main-page-editor.utils";

function projection(): MainPageEditorTypes.BatchProjection {
  return {
    admissionError: null,
    capacity: { current: 1, limit: 20 },
    counts: { active: 0, queued: 0, completed: 1, failed: 0 },
    export: { status: "idle", includedCount: 0, skippedCount: 0, error: null },
    items: [
      {
        documentId: createDocumentId("document-1"),
        error: null,
        fileName: "portrait.png",
        itemId: createWorkspaceItemId("item-1"),
        previewUrl: "blob:preview",
        qualityMode: "isnet-q8",
        queuePosition: null,
        selected: true,
        status: "result",
      },
    ],
  };
}

describe("batchMainPageProjectionEqual", () => {
  it("accepts equivalent immutable projections", () => {
    expect(batchMainPageProjectionEqual(projection(), projection())).toBe(true);
  });

  it("observes nested item and export changes", () => {
    const previous = projection();
    expect(
      batchMainPageProjectionEqual(previous, {
        ...previous,
        items: [{ ...previous.items[0]!, queuePosition: 2, status: "queued" }],
      }),
    ).toBe(false);
    expect(
      batchMainPageProjectionEqual(previous, {
        ...previous,
        export: { ...previous.export, status: "preparing" },
      }),
    ).toBe(false);
  });
});
