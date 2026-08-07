import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import {
  createEditOperationId,
  createMagicCandidateId,
  createMagicDraftId,
  createManualDraftId,
  createRunId,
} from "@/editor/domain";
import { buildDocumentSnapshot, buildDocumentState } from "@/editor/testing";

import {
  createDocumentMachine,
  ProcessingGatewayError,
  type DocumentMachineTypes,
} from "./index";

const draftId = createMagicDraftId("magic-draft-1");
const candidateId = createMagicCandidateId("candidate-1");
const runId = createRunId("magic-run-1");

function artifacts(): DocumentMachineTypes.ArtifactEffects {
  return {
    estimateHistoricalBytes: () => 12,
    exportPng: vi.fn(),
    promoteRun: vi.fn(() => true),
    releaseDocument: vi.fn(),
    releaseRun: vi.fn(),
    releaseManualDraft: vi.fn(),
    commitManualHistory: vi.fn(),
    releaseMagicDraft: vi.fn(),
    commitMagicHistory: vi.fn(),
    moveDocumentHistory: vi.fn(),
  };
}

function machine(options: {
  predict(
    signal: AbortSignal,
  ): Promise<readonly { candidateId: typeof candidateId; score: number }[]>;
  commit(signal: AbortSignal): Promise<ReturnType<typeof buildDocumentSnapshot>>;
}) {
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
        throw new Error("Automatic inference must not run during Magic");
      },
      dispose: () => Promise.resolve(),
    },
    runIds: { next: () => createRunId("automatic-unused") },
    manualIds: {
      draft: () => createManualDraftId("manual-unused"),
      operation: () => createEditOperationId("magic-operation-1"),
    },
    magicIds: { draft: () => draftId },
    manualCommitter: {
      commit: () => Promise.reject(new Error("Manual commit must not run during Magic")),
    },
    magicPredictor: {
      predict: (_input, signal) => options.predict(signal),
    },
    magicCommitter: {
      commit: (_input, signal) => options.commit(signal),
    },
  });
}

function resultDocument() {
  const snapshot = buildDocumentSnapshot();
  return buildDocumentState({
    committed: snapshot,
    baseline: snapshot,
    revision: 4,
    status: "result",
  });
}

function beginAndDirty(actor: DocumentMachineTypes.ActorRef) {
  const documentId = actor.getSnapshot().context.document.documentId;
  actor.send({
    type: "COMMAND",
    command: { type: "BEGIN_MAGIC_CUTOUT", documentId, expectedRevision: 4 },
  });
  actor.send({
    type: "COMMAND",
    command: {
      type: "MAGIC_DRAFT_CHANGED",
      documentId,
      draftId,
      expectedRevision: 4,
      draftRevision: 1,
      dirty: true,
    },
  });
  return documentId;
}

describe("Magic document actor", () => {
  it("predicts outside the actor and commits exactly one selected candidate", async () => {
    const after = buildDocumentSnapshot();
    const predict = vi.fn(() => Promise.resolve([{ candidateId, score: 0.95 }] as const));
    const commit = vi.fn(() => Promise.resolve(after));
    const actor = createActor(machine({ predict, commit }), {
      input: { document: resultDocument() },
    });
    actor.start();
    const documentId = beginAndDirty(actor);
    actor.send({
      type: "COMMAND",
      command: {
        type: "PREDICT_MAGIC_CUTOUT",
        documentId,
        draftId,
        runId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    });

    await vi.waitFor(() =>
      expect(actor.getSnapshot().context.document.magicCandidates).toHaveLength(1),
    );
    actor.send({
      type: "COMMAND",
      command: {
        type: "SELECT_MAGIC_CANDIDATE",
        documentId,
        draftId,
        candidateId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    });
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_MAGIC_CUTOUT",
        documentId,
        draftId,
        candidateId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    });

    await vi.waitFor(() => expect(actor.getSnapshot().context.document.revision).toBe(5));
    expect(predict).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.document).toMatchObject({
      committed: after,
      activeDraft: null,
      activeMagicPrediction: null,
      pendingMagicCommit: null,
      status: "result",
    });
    expect(actor.getSnapshot().context.document.history.past[0]?.kind).toBe(
      "magic-cutout",
    );
    actor.stop();
  });

  it("aborts prediction when Magic is cancelled and preserves the committed revision", async () => {
    const aborted = vi.fn();
    const predict = vi.fn(
      (signal: AbortSignal) =>
        new Promise<readonly { candidateId: typeof candidateId; score: number }[]>(
          (_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                aborted();
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          },
        ),
    );
    const actor = createActor(
      machine({
        predict,
        commit: () => Promise.reject(new Error("Commit must not run")),
      }),
      { input: { document: resultDocument() } },
    );
    actor.start();
    const documentId = beginAndDirty(actor);
    actor.send({
      type: "COMMAND",
      command: {
        type: "PREDICT_MAGIC_CUTOUT",
        documentId,
        draftId,
        runId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    });
    await vi.waitFor(() => expect(predict).toHaveBeenCalledOnce());
    actor.send({
      type: "COMMAND",
      command: { type: "CANCEL_MAGIC_CUTOUT", documentId, draftId },
    });

    await vi.waitFor(() => expect(aborted).toHaveBeenCalledOnce());
    expect(actor.getSnapshot().context.document).toMatchObject({
      revision: 4,
      activeDraft: null,
      activeMagicPrediction: null,
      magicCandidates: [],
      status: "result",
    });
    expect(actor.getSnapshot().context.document.history.past).toHaveLength(0);
    actor.stop();
  });

  it("retains the draft and committed state after a retryable prediction failure", async () => {
    const actor = createActor(
      machine({
        predict: () => Promise.reject(new Error("retry prediction")),
        commit: () => Promise.reject(new Error("Commit must not run")),
      }),
      { input: { document: resultDocument() } },
    );
    actor.start();
    const documentId = beginAndDirty(actor);
    actor.send({
      type: "COMMAND",
      command: {
        type: "PREDICT_MAGIC_CUTOUT",
        documentId,
        draftId,
        runId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    });

    await vi.waitFor(() =>
      expect(actor.getSnapshot().context.document.error?.message).toBe(
        "retry prediction",
      ),
    );
    expect(actor.getSnapshot().context.document).toMatchObject({
      revision: 4,
      committed: buildDocumentSnapshot(),
      activeDraft: {
        kind: "magic-cutout",
        draftId,
        draftRevision: 1,
        status: "error",
      },
      activeMagicPrediction: null,
      status: "result",
    });
    expect(actor.getSnapshot().context.document.history.past).toHaveLength(0);
    actor.stop();
  });

  it("preserves structured predictor errors across the actor boundary", async () => {
    const actor = createActor(
      machine({
        predict: () =>
          Promise.reject(
            new ProcessingGatewayError({
              code: "model-load-failed",
              message: "SlimSAM could not load",
              retryable: false,
            }),
          ),
        commit: () => Promise.reject(new Error("Commit must not run")),
      }),
      { input: { document: resultDocument() } },
    );
    actor.start();
    const documentId = beginAndDirty(actor);
    actor.send({
      type: "COMMAND",
      command: {
        type: "PREDICT_MAGIC_CUTOUT",
        documentId,
        draftId,
        runId,
        expectedRevision: 4,
        draftRevision: 1,
      },
    });

    await vi.waitFor(() =>
      expect(actor.getSnapshot().context.document.error).toEqual({
        code: "model-load-failed",
        message: "SlimSAM could not load",
        retryable: false,
      }),
    );
    actor.stop();
  });
});
