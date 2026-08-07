import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import { createDocumentMachine, type DocumentMachineTypes } from "@/v2/application";
import {
  createArtifactId,
  createDocumentId,
  createEditOperationId,
  createMagicCandidateId,
  createMagicDraftId,
  createManualDraftId,
  createRunId,
} from "@/v2/domain";
import { buildDocumentSnapshot, buildDocumentState } from "@/v2/testing";

import { MagicCandidateRepository } from "./magic-candidate-repository";
import { MagicCutoutController } from "./magic-cutout-controller";
import { MagicDraftRepository } from "./magic-draft-repository";

function artifactEffects(): DocumentMachineTypes.ArtifactEffects {
  return {
    estimateHistoricalBytes: () => 0,
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

describe("MagicCutoutController", () => {
  it("owns runtime draft/candidate cleanup while the actor owns metadata", () => {
    const documentId = createDocumentId("document-1");
    const draftId = createMagicDraftId("draft-1");
    const candidateId = createMagicCandidateId("candidate-1");
    const machine = createDocumentMachine({
      artifacts: artifactEffects(),
      cancellation: {
        create() {
          const controller = new AbortController();
          return { signal: controller.signal, abort: () => controller.abort() };
        },
      },
      gateway: {
        start: () => {
          throw new Error("automatic work is not expected");
        },
        dispose: () => Promise.resolve(),
      },
      runIds: { next: () => createRunId("automatic-unused") },
      manualIds: {
        draft: () => createManualDraftId("manual-unused"),
        operation: () => createEditOperationId("operation-unused"),
      },
      magicIds: { draft: () => draftId },
      manualCommitter: { commit: () => Promise.reject(new Error("unused")) },
    });
    const snapshot = buildDocumentSnapshot();
    const actor = createActor(machine, {
      input: {
        document: buildDocumentState({
          documentId,
          source: createArtifactId("source-1"),
          committed: snapshot,
          baseline: snapshot,
          status: "result",
        }),
      },
    });
    actor.start();
    const drafts = new MagicDraftRepository();
    const candidates = new MagicCandidateRepository(() => candidateId);
    const controller = new MagicCutoutController({
      actor: () => actor,
      candidates,
      dimensions: () => ({ width: 1, height: 1 }),
      documentId: () => documentId,
      drafts,
      nextRunId: () => createRunId("run-1"),
    });

    controller.begin();
    const draft = controller.draft();
    expect(draft).not.toBeNull();
    draft?.beginStroke({
      id: "stroke-1",
      mode: "keep",
      radius: 1,
      point: { x: 0, y: 0 },
    });
    draft?.commitStroke();
    controller.notifyChanged();
    expect(actor.getSnapshot().context.document.activeDraft).toMatchObject({
      kind: "magic-cutout",
      draftRevision: 1,
      dirty: true,
    });
    candidates.replace({
      base: null,
      correlation: {
        documentId,
        draftId,
        runId: createRunId("run-1"),
        expectedRevision: 0,
        draftRevision: 1,
      },
      raw: [{ data: new Uint8ClampedArray([255]).buffer, width: 1, height: 1, score: 1 }],
      source: createArtifactId("source-1"),
      strokes: draft?.predictionStrokes() ?? [],
    });

    controller.cancel();
    expect(drafts.size).toBe(0);
    expect(candidates.size).toBe(0);
    expect(actor.getSnapshot().context.document.activeDraft).toBeNull();
    actor.stop();
  });
});
