import { describe, expect, it, vi } from "vitest";

import {
  EditorArtifactStore,
  createEditDocumentScope,
  disposeEditDocumentScope,
  resolveEditDocumentImage,
} from "../../../entities/edit-document";
import type { ProcessedImage } from "../../../entities/processed-image";
import {
  EDIT_HISTORY_BYTE_LIMIT,
  EDIT_HISTORY_ENTRY_LIMIT,
  commitProcessedImage,
  commitProcessedImageIfCurrent,
  redoEdit,
  resetEditDocument,
  selectEditHistory,
  undoEdit,
} from "./editor-history";

const source = {
  blob: new Blob(["source"], { type: "image/png" }),
  width: 1,
  height: 1,
  format: "image/png" as const,
};

function image(name: string): ProcessedImage {
  return {
    source,
    result: new Blob([name]),
    qualityMode: "isnet-q8",
    alphaMatte: {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([name.length]),
    },
    backgroundFill: { type: "transparent" },
  };
}

describe("editor history", () => {
  it("commits labeled operations and traverses them atomically", async () => {
    let scope = createEditDocumentScope(image("base"));
    scope = commitProcessedImage(scope, image("manual"), {
      kind: "manual",
      label: "Manual correction",
    });
    scope = commitProcessedImage(scope, image("enhance"), {
      kind: "enhance",
      label: "Enhance",
    });
    expect(scope.document.revision).toBe(2);
    expect(scope.history.past.map((operation) => operation.kind)).toEqual([
      "manual",
      "enhance",
    ]);
    expect(selectEditHistory(scope.history, "en")).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoLabel: "Undo: Enhance",
    });

    scope = undoEdit(scope);
    expect(await resolveEditDocumentImage(scope).result.text()).toBe("manual");
    expect(selectEditHistory(scope.history, "ru").redoLabel).toBe("Вернуть: Enhance");
    scope = redoEdit(scope);
    expect(await resolveEditDocumentImage(scope).result.text()).toBe("enhance");

    scope = resetEditDocument(scope);
    expect(await resolveEditDocumentImage(scope).result.text()).toBe("base");
    expect(scope.history).toMatchObject({ past: [], future: [] });
  });

  it("drops redo artifacts on a branch and ignores stale async completion", () => {
    const revokeObjectURL = vi.fn();
    const artifacts = new EditorArtifactStore({
      createObjectURL: () => "blob:old",
      revokeObjectURL,
    });
    let scope = createEditDocumentScope(image("base"), { artifacts });
    scope = commitProcessedImage(scope, image("first"), {
      kind: "cutout",
      label: "First",
    });
    scope = commitProcessedImage(scope, image("second"), {
      kind: "cutout",
      label: "Second",
    });
    const secondComposite = scope.document.current.composite;
    scope.artifacts.getObjectUrl(secondComposite);
    scope = undoEdit(scope);
    const expectedRevision = scope.document.revision;
    scope = commitProcessedImage(scope, image("branch"), {
      kind: "background",
      label: "Branch",
    });
    expect(scope.history.future).toHaveLength(0);
    expect(scope.artifacts.get(secondComposite)).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:old");

    const stale = commitProcessedImageIfCurrent(scope, expectedRevision, image("stale"), {
      kind: "enhance",
      label: "Stale",
    });
    expect(stale).toBe(scope);
    expect(scope.history.past.at(-1)?.label).toBe("Branch");
  });

  it("keeps uploaded backgrounds reachable through undo and releases a replaced branch", () => {
    let nextUrl = 0;
    const revokeObjectURL = vi.fn();
    const artifacts = new EditorArtifactStore({
      createObjectURL: () => `blob:background-${String(++nextUrl)}`,
      revokeObjectURL,
    });
    let scope = createEditDocumentScope(image("base"), { artifacts });
    const firstBackground = new Blob(["first-background"], { type: "image/png" });
    scope = commitProcessedImage(
      scope,
      {
        ...image("first"),
        backgroundFill: { type: "image", blob: firstBackground },
      },
      { kind: "background", label: "Background" },
    );
    const firstBackgroundId = artifacts.idOf(firstBackground);
    expect(firstBackgroundId).not.toBeNull();
    artifacts.getObjectUrl(firstBackgroundId!);

    scope = undoEdit(scope);
    expect(artifacts.get(firstBackgroundId!)).not.toBeNull();
    scope = redoEdit(scope);
    expect(resolveEditDocumentImage(scope).backgroundFill).toEqual({
      type: "image",
      blob: firstBackground,
    });

    scope = undoEdit(scope);
    scope = commitProcessedImage(
      scope,
      {
        ...image("branch"),
        backgroundFill: { type: "color", value: "#ABCDEF" },
      },
      { kind: "background", label: "Background" },
    );
    expect(scope.history.future).toHaveLength(0);
    expect(artifacts.get(firstBackgroundId!)).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:background-1");
  });

  it("bounds entry count and retained unique history bytes", () => {
    let nextId = 0;
    const artifacts = new EditorArtifactStore({
      createId: () => `id-${String(++nextId)}`,
      estimateBytes: (value) =>
        value instanceof Blob ? 60 * 1024 * 1024 : value.data.byteLength,
    });
    let scope = createEditDocumentScope(image("base"), { artifacts });
    for (let index = 0; index < EDIT_HISTORY_ENTRY_LIMIT + 4; index += 1)
      scope = commitProcessedImage(scope, image(`edit-${String(index)}`), {
        kind: "manual",
        label: `Edit ${String(index)}`,
      });
    expect(scope.history.past.length).toBeLessThanOrEqual(EDIT_HISTORY_ENTRY_LIMIT);
    expect(scope.history.retainedHistoricalBytes).toBeLessThanOrEqual(
      EDIT_HISTORY_BYTE_LIMIT,
    );
    expect(scope.history.past).toHaveLength(1);

    disposeEditDocumentScope(scope);
  });

  it("keeps baseline, current, and the newest oversized undo step safe", async () => {
    let nextId = 0;
    const artifacts = new EditorArtifactStore({
      createId: () => `oversized-${String(++nextId)}`,
      estimateBytes: (value) =>
        value instanceof Blob ? EDIT_HISTORY_BYTE_LIMIT + 1 : value.data.byteLength,
    });
    let scope = createEditDocumentScope(image("base"), { artifacts });
    const baselineComposite = scope.document.baseline.composite;
    scope = commitProcessedImage(scope, image("first"), {
      kind: "manual",
      label: "First",
    });
    const firstComposite = scope.document.current.composite;
    scope = commitProcessedImage(scope, image("second"), {
      kind: "enhance",
      label: "Newest oversized",
    });
    const currentComposite = scope.document.current.composite;

    expect(scope.history.past).toHaveLength(1);
    expect(scope.history.past[0]?.label).toBe("Newest oversized");
    expect(scope.history.retainedHistoricalBytes).toBeGreaterThan(
      EDIT_HISTORY_BYTE_LIMIT,
    );
    expect(scope.artifacts.get(baselineComposite)).not.toBeNull();
    expect(scope.artifacts.get(firstComposite)).not.toBeNull();
    expect(scope.artifacts.get(currentComposite)).not.toBeNull();

    scope = undoEdit(scope);
    expect(await resolveEditDocumentImage(scope).result.text()).toBe("first");
    expect(scope.artifacts.get(baselineComposite)).not.toBeNull();
    expect(scope.artifacts.get(currentComposite)).not.toBeNull();
  });
});
