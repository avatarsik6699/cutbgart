import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import { createDocumentMachine } from "@/editor/application";
import {
  createEditOperationId,
  createMagicDraftId,
  createManualDraftId,
  createRunId,
} from "@/editor/domain";
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
      magicIds: { draft: () => createMagicDraftId("magic-draft-1") },
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

  it("closes a clean auto-opened draft before moving committed history", () => {
    const actor = resultActor();
    const order: string[] = [];
    const session = {
      cancelMagic: vi.fn(() => {
        order.push("cancel-draft");
        const draft = actor.getSnapshot().context.document.activeDraft;
        if (draft?.kind === "magic-cutout") {
          actor.send({
            type: "COMMAND",
            command: {
              type: "CANCEL_MAGIC_CUTOUT",
              documentId: draft.documentId,
              draftId: draft.draftId,
            },
          });
        }
      }),
      undoDocument: vi.fn(() => order.push("undo-document")),
    };
    const editor = { session, leaveDocument: vi.fn() } as unknown as EditorModel;
    const model = new ActiveDocumentModel(editor, actor);
    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_MAGIC_CUTOUT",
        documentId: actor.getSnapshot().context.document.documentId,
        expectedRevision: actor.getSnapshot().context.document.revision,
      },
    });

    model.undoDocument();

    expect(order).toEqual(["cancel-draft", "undo-document"]);
    expect(actor.getSnapshot().context.document.activeDraft).toBeNull();
    actor.stop();
  });

  it("routes model reprocessing through the existing dirty-draft guard", () => {
    const actor = resultActor();
    const reprocessCurrentModel = vi.fn(() => true);
    const session = {
      beginMagic: vi.fn(() => {
        actor.send({
          type: "COMMAND",
          command: {
            type: "BEGIN_MAGIC_CUTOUT",
            documentId: actor.getSnapshot().context.document.documentId,
            expectedRevision: actor.getSnapshot().context.document.revision,
          },
        });
      }),
      cancelMagic: vi.fn(() => {
        const draft = actor.getSnapshot().context.document.activeDraft;
        if (draft?.kind !== "magic-cutout") return;
        actor.send({
          type: "COMMAND",
          command: {
            type: "CANCEL_MAGIC_CUTOUT",
            documentId: draft.documentId,
            draftId: draft.draftId,
          },
        });
      }),
    };
    const editor = {
      session,
      leaveDocument: vi.fn(),
      reprocessCurrentModel,
    } as unknown as EditorModel;
    const model = new ActiveDocumentModel(editor, actor);
    model.ensureSelectedToolOpen();
    const draft = actor.getSnapshot().context.document.activeDraft;
    if (draft?.kind !== "magic-cutout") throw new Error("Magic draft was not opened");
    actor.send({
      type: "COMMAND",
      command: {
        type: "MAGIC_DRAFT_CHANGED",
        documentId: draft.documentId,
        draftId: draft.draftId,
        expectedRevision: draft.baselineRevision,
        draftRevision: 1,
        dirty: true,
      },
    });

    model.requestModel("isnet-fp32");
    expect(model.viewStore.getSnapshot().pendingNavigation).toEqual({
      type: "reprocess",
      modelMode: "isnet-fp32",
    });
    expect(reprocessCurrentModel).not.toHaveBeenCalled();

    model.keepEditing();
    expect(model.viewStore.getSnapshot().pendingNavigation).toBeNull();
    model.requestModel("isnet-fp32");
    model.discardAndContinue();
    expect(session.cancelMagic).toHaveBeenCalledOnce();
    expect(reprocessCurrentModel).toHaveBeenCalledWith("isnet-fp32");
    actor.stop();
  });
});
