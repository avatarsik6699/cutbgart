import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import {
  createBackgroundDraftId,
  createEditOperationId,
  createEnhancementDraftId,
  createManualDraftId,
  createRunId,
} from "@/editor/domain";
import { buildDocumentSnapshot, buildDocumentState } from "@/editor/testing";

import {
  createDocumentMachine,
  type BackgroundCommitter,
  type DocumentMachineTypes,
  type EnhancementCommitter,
} from "./index";

function artifactEffects(): DocumentMachineTypes.ArtifactEffects {
  return {
    estimateHistoricalBytes: () => 10,
    exportPng: vi.fn(),
    promoteRun: vi.fn(() => true),
    releaseDocument: vi.fn(),
    releaseRun: vi.fn(),
    releaseManualDraft: vi.fn(),
    commitManualHistory: vi.fn(),
    moveDocumentHistory: vi.fn(),
    releaseBackgroundDraft: vi.fn(),
    commitBackgroundHistory: vi.fn(),
    releaseEnhancementDraft: vi.fn(),
    commitEnhancementHistory: vi.fn(),
  };
}

function machine(options: {
  backgroundCommit: BackgroundCommitter["commit"];
  enhancementCommit: EnhancementCommitter["commit"];
}) {
  return createDocumentMachine({
    artifacts: artifactEffects(),
    cancellation: {
      create() {
        const controller = new AbortController();
        return { signal: controller.signal, abort: () => controller.abort() };
      },
    },
    gateway: {
      start() {
        throw new Error("Automatic processing is not used by this test");
      },
      dispose: vi.fn(() => Promise.resolve()),
    },
    runIds: { next: () => createRunId("automatic-unused") },
    manualIds: {
      draft: () => createManualDraftId("manual-unused"),
      operation: () => createEditOperationId("manual-operation-unused"),
    },
    finishingIds: {
      backgroundDraft: () => createBackgroundDraftId("background-draft-1"),
      enhancementDraft: () => createEnhancementDraftId("enhancement-draft-1"),
      operation: () => createEditOperationId("finishing-operation-1"),
    },
    manualCommitter: {
      commit: vi.fn(() => Promise.reject(new Error("Manual is not used"))),
    },
    backgroundCommitter: { commit: options.backgroundCommit },
    enhancementCommitter: { commit: options.enhancementCommit },
  });
}

describe("finishing-tool document actor", () => {
  it("invokes Background materialization and publishes one actor-owned commit", async () => {
    const before = buildDocumentSnapshot();
    const after = buildDocumentSnapshot({
      background: { type: "color", value: "#112233" },
    });
    const backgroundCommit = vi.fn<BackgroundCommitter["commit"]>(() =>
      Promise.resolve(after),
    );
    const actor = createActor(
      machine({
        backgroundCommit,
        enhancementCommit: vi.fn(() =>
          Promise.resolve({ outcome: "unchanged" as const }),
        ),
      }),
      {
        input: {
          document: buildDocumentState({
            committed: before,
            baseline: before,
            revision: 2,
            status: "result",
          }),
        },
      },
    ).start();
    const documentId = actor.getSnapshot().context.document.documentId;
    actor.send({
      type: "COMMAND",
      command: { type: "BEGIN_BACKGROUND", documentId, expectedRevision: 2 },
    });
    const draft = actor.getSnapshot().context.document.activeDraft;
    expect(draft?.kind).toBe("background");
    if (draft?.kind !== "background") throw new Error("Background draft was not created");
    actor.send({
      type: "COMMAND",
      command: {
        type: "CHANGE_BACKGROUND",
        documentId,
        draftId: draft.draftId,
        expectedRevision: 2,
        draftRevision: 1,
        fill: { type: "color", value: "#112233" },
      },
    });
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_BACKGROUND",
        documentId,
        draftId: draft.draftId,
        expectedRevision: 2,
        draftRevision: 1,
      },
    });
    await vi.waitFor(() => expect(actor.getSnapshot().context.document.revision).toBe(3));
    expect(backgroundCommit).toHaveBeenCalledOnce();
    expect(backgroundCommit.mock.calls[0]?.[0]).toMatchObject({
      documentId,
      draftId: draft.draftId,
      expectedRevision: 2,
      draftRevision: 1,
      snapshot: before,
      fill: { type: "color", value: "#112233" },
    });
    expect(actor.getSnapshot().context.document.history.past[0]?.kind).toBe("background");
    actor.send({
      type: "COMMAND",
      command: { type: "UNDO_DOCUMENT", documentId, expectedRevision: 3 },
    });
    expect(actor.getSnapshot().context.document.committed).toBe(before);
    actor.send({
      type: "COMMAND",
      command: { type: "REDO_DOCUMENT", documentId, expectedRevision: 4 },
    });
    expect(actor.getSnapshot().context.document.committed).toBe(after);
    actor.send({
      type: "COMMAND",
      command: { type: "EXPORT_PNG", documentId, expectedRevision: 5 },
    });
    expect(backgroundCommit).toHaveBeenCalledOnce();
    actor.stop();
  });

  it("aborts an invoked Enhancement run on explicit Cancel without committing", async () => {
    let receivedSignal: AbortSignal | null = null;
    const enhancementCommit = vi.fn(
      (_input: unknown, signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          receivedSignal = signal;
          signal.addEventListener("abort", () => reject(new Error("cancelled")), {
            once: true,
          });
        }),
    );
    const before = buildDocumentSnapshot();
    const actor = createActor(
      machine({
        backgroundCommit: vi.fn(() => Promise.resolve(before)),
        enhancementCommit,
      }),
      {
        input: {
          document: buildDocumentState({
            committed: before,
            baseline: before,
            revision: 4,
            status: "result",
          }),
        },
      },
    ).start();
    const documentId = actor.getSnapshot().context.document.documentId;
    actor.send({
      type: "COMMAND",
      command: { type: "BEGIN_ENHANCEMENTS", documentId, expectedRevision: 4 },
    });
    const draft = actor.getSnapshot().context.document.activeDraft;
    if (draft?.kind !== "enhance") throw new Error("Enhancement draft was not created");
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId,
        draftId: draft.draftId,
        runId: createRunId("enhancement-run-1"),
        expectedRevision: 4,
      },
    });
    await vi.waitFor(() => expect(enhancementCommit).toHaveBeenCalledOnce());
    actor.send({
      type: "COMMAND",
      command: { type: "CANCEL_ENHANCEMENTS", documentId, draftId: draft.draftId },
    });
    await vi.waitFor(() => expect(receivedSignal?.aborted).toBe(true));
    expect(actor.getSnapshot().context.document).toMatchObject({
      committed: before,
      revision: 4,
      activeDraft: null,
      pendingEnhancementCommit: null,
      status: "result",
    });
    expect(actor.getSnapshot().context.document.history.past).toEqual([]);
    actor.stop();
  });

  it("keeps the invoked Enhancement correlation when a duplicate Apply arrives", async () => {
    let resolveCommit: ((value: { outcome: "unchanged" }) => void) | undefined;
    const enhancementCommit = vi.fn(
      () =>
        new Promise<{ outcome: "unchanged" }>((resolve) => {
          resolveCommit = resolve;
        }),
    );
    const before = buildDocumentSnapshot();
    const actor = createActor(
      machine({
        backgroundCommit: vi.fn(() => Promise.resolve(before)),
        enhancementCommit,
      }),
      {
        input: {
          document: buildDocumentState({
            committed: before,
            baseline: before,
            revision: 6,
            status: "result",
          }),
        },
      },
    ).start();
    const documentId = actor.getSnapshot().context.document.documentId;
    actor.send({
      type: "COMMAND",
      command: { type: "BEGIN_ENHANCEMENTS", documentId, expectedRevision: 6 },
    });
    const draft = actor.getSnapshot().context.document.activeDraft;
    if (draft?.kind !== "enhance") throw new Error("Enhancement draft was not created");
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId,
        draftId: draft.draftId,
        runId: createRunId("enhancement-run-original"),
        expectedRevision: 6,
      },
    });
    await vi.waitFor(() => expect(enhancementCommit).toHaveBeenCalledOnce());
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId,
        draftId: draft.draftId,
        runId: createRunId("enhancement-run-duplicate"),
        expectedRevision: 6,
      },
    });
    expect(actor.getSnapshot().context.lastCommandOutcome).toMatchObject({
      status: "rejected",
      reason: "operation-active",
    });
    expect(actor.getSnapshot().context.document.pendingEnhancementCommit?.runId).toBe(
      "enhancement-run-original",
    );
    resolveCommit?.({ outcome: "unchanged" });
    await vi.waitFor(() =>
      expect(actor.getSnapshot().context.document.pendingEnhancementCommit).toBeNull(),
    );
    expect(enhancementCommit).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.document.revision).toBe(6);
    actor.stop();
  });
});
