import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import { createDocumentMachine } from "@/editor/application";
import { createEditOperationId, createManualDraftId, createRunId } from "@/editor/domain";
import { buildDocumentSnapshot, buildDocumentState } from "@/editor/testing";

import { ActiveDocumentModel } from "./active-document-model";
import type { EditorModel } from "./editor-model";

function resultActor() {
  const committed = buildDocumentSnapshot();
  const actor = createActor(
    createDocumentMachine({
      artifacts: {
        estimateHistoricalBytes: () => 0,
        exportPng: vi.fn(),
        promoteRun: () => true,
        releaseDocument: vi.fn(),
        releaseRun: vi.fn(),
        releaseManualDraft: vi.fn(),
        commitManualHistory: vi.fn(),
        moveDocumentHistory: vi.fn(),
      },
      cancellation: {
        create() {
          const controller = new AbortController();
          return { signal: controller.signal, abort: () => controller.abort() };
        },
      },
      gateway: { start: vi.fn(), dispose: () => Promise.resolve() },
      runIds: { next: () => createRunId("run-1") },
      manualIds: {
        draft: () => createManualDraftId("manual-draft-1"),
        operation: () => createEditOperationId("operation-1"),
      },
      manualCommitter: { commit: () => Promise.reject(new Error("unexpected")) },
    }),
    {
      input: {
        document: buildDocumentState({
          baseline: committed,
          committed,
          status: "result",
        }),
      },
    },
  );
  actor.start();
  return actor;
}

describe("ActiveDocumentModel", () => {
  it("owns UI-only tool selection and opens the default tool idempotently", () => {
    const actor = resultActor();
    const session = {
      beginBackground: vi.fn(),
      beginEnhancements: vi.fn(),
      beginMagic: vi.fn(),
      beginManual: vi.fn(),
    };
    const editor = { session, leaveDocument: vi.fn() } as unknown as EditorModel;
    const model = new ActiveDocumentModel(editor, actor);

    model.ensureSelectedToolOpen();
    model.ensureSelectedToolOpen();
    expect(session.beginMagic).toHaveBeenCalledOnce();

    model.requestTool("background");
    expect(model.viewStore.getSnapshot().activeTool).toBe("background");
    expect(session.beginBackground).toHaveBeenCalledOnce();

    actor.stop();
  });

  it("routes history through the mounted tool owner", () => {
    const actor = resultActor();
    const editor = { session: {}, leaveDocument: vi.fn() } as unknown as EditorModel;
    const model = new ActiveDocumentModel(editor, actor);
    const undo = vi.fn();
    const redo = vi.fn();
    const unregister = model.registerDraftHistory({ undo, redo });

    model.undoDraft();
    model.redoDraft();
    expect(undo).toHaveBeenCalledOnce();
    expect(redo).toHaveBeenCalledOnce();

    unregister();
    model.undoDraft();
    expect(undo).toHaveBeenCalledOnce();
    actor.stop();
  });
});
