import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createEditOperationId,
  createManualDraftId,
  createRunId,
  type DocumentSnapshot,
} from "@/v2/domain";
import { buildDocumentSnapshot, buildDocumentState } from "@/v2/testing";

import {
  createDocumentMachine,
  type DocumentMachineTypes,
  type ManualCutoutCommitter,
} from "./index";

function artifacts(): DocumentMachineTypes.ArtifactEffects {
  return {
    estimateHistoricalBytes: () => 12,
    exportPng: vi.fn(),
    promoteRun: vi.fn(() => true),
    releaseDocument: vi.fn(),
    releaseRun: vi.fn(),
    releaseManualDraft: vi.fn(),
    commitManualHistory: vi.fn(),
    moveDocumentHistory: vi.fn(),
  };
}

function machine(commit: ManualCutoutCommitter) {
  return createDocumentMachine({
    artifacts: artifacts(),
    cancellation: {
      create() {
        const controller = new AbortController();
        return { signal: controller.signal, abort: () => controller.abort() };
      },
    },
    gateway: {
      start() {
        throw new Error("Automatic inference must not run during Manual");
      },
      dispose: () => Promise.resolve(),
    },
    runIds: { next: () => createRunId("run-unused") },
    manualIds: {
      draft: () => createManualDraftId("draft-1"),
      operation: () => createEditOperationId("operation-1"),
    },
    manualCommitter: commit,
  });
}

describe("manual document actor", () => {
  it("keeps gestures local and applies exactly one atomic committed operation", async () => {
    const before = buildDocumentSnapshot();
    const after: DocumentSnapshot = {
      matte: createArtifactId("matte-manual"),
      foreground: null,
      composite: createArtifactId("composite-manual"),
      background: before.background,
    };
    const commit = vi.fn(() => Promise.resolve(after));
    const actor = createActor(machine({ commit }), {
      input: {
        document: buildDocumentState({
          committed: before,
          revision: 1,
          status: "result",
        }),
      },
    });
    actor.start();
    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_MANUAL_CUTOUT",
        documentId: actor.getSnapshot().context.document.documentId,
        expectedRevision: 1,
      },
    });
    const draft = actor.getSnapshot().context.document.activeDraft;
    expect(draft?.dirty).toBe(false);
    if (draft?.kind !== "manual-cutout") throw new Error("Expected a manual draft");
    actor.send({
      type: "DOMAIN_EVENT",
      event: {
        type: "MANUAL_DRAFT_DIRTY_CHANGED",
        documentId: draft.documentId,
        draftId: draft.draftId,
        dirty: true,
      },
    });
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_MANUAL_CUTOUT",
        documentId: draft.documentId,
        draftId: draft.draftId,
        expectedRevision: 1,
        draftMatte: after.matte,
      },
    });

    await vi.waitFor(() => expect(actor.getSnapshot().context.document.revision).toBe(2));
    const applied = actor.getSnapshot().context.document;
    expect(commit).toHaveBeenCalledOnce();
    expect(applied.activeDraft).toBeNull();
    expect(applied.history.past).toHaveLength(1);
    expect(applied.history.retainedHistoricalBytes).toBe(12);

    actor.send({
      type: "COMMAND",
      command: {
        type: "UNDO_DOCUMENT",
        documentId: applied.documentId,
        expectedRevision: 2,
      },
    });
    expect(actor.getSnapshot().context.document).toMatchObject({
      committed: before,
      revision: 3,
    });
    actor.send({
      type: "COMMAND",
      command: {
        type: "REDO_DOCUMENT",
        documentId: applied.documentId,
        expectedRevision: 3,
      },
    });
    expect(actor.getSnapshot().context.document).toMatchObject({
      committed: after,
      revision: 4,
    });
    actor.stop();
  });

  it("keeps the committed revision bit-exact on Cancel and retains a draft after failure", async () => {
    const before = buildDocumentSnapshot();
    const commit = vi.fn(() => Promise.reject(new Error("retryable")));
    const actor = createActor(machine({ commit }), {
      input: {
        document: buildDocumentState({
          committed: before,
          revision: 7,
          status: "result",
        }),
      },
    });
    actor.start();
    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_MANUAL_CUTOUT",
        documentId: actor.getSnapshot().context.document.documentId,
        expectedRevision: 7,
      },
    });
    let draft = actor.getSnapshot().context.document.activeDraft;
    if (draft?.kind !== "manual-cutout") throw new Error("Expected a manual draft");
    actor.send({
      type: "COMMAND",
      command: {
        type: "CANCEL_MANUAL_CUTOUT",
        documentId: draft.documentId,
        draftId: draft.draftId,
      },
    });
    expect(actor.getSnapshot().context.document).toMatchObject({
      committed: before,
      revision: 7,
      activeDraft: null,
    });

    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_MANUAL_CUTOUT",
        documentId: draft.documentId,
        expectedRevision: 7,
      },
    });
    draft = actor.getSnapshot().context.document.activeDraft;
    if (draft?.kind !== "manual-cutout") throw new Error("Expected retry draft");
    actor.send({
      type: "DOMAIN_EVENT",
      event: {
        type: "MANUAL_DRAFT_DIRTY_CHANGED",
        documentId: draft.documentId,
        draftId: draft.draftId,
        dirty: true,
      },
    });
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_MANUAL_CUTOUT",
        documentId: draft.documentId,
        draftId: draft.draftId,
        expectedRevision: 7,
        draftMatte: createArtifactId("draft-matte"),
      },
    });
    await vi.waitFor(() =>
      expect(actor.getSnapshot().context.document.error?.message).toBe("retryable"),
    );
    expect(actor.getSnapshot().context.document).toMatchObject({
      committed: before,
      revision: 7,
      activeDraft: { dirty: true },
    });
    actor.stop();
  });
});
