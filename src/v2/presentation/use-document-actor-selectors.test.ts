import { createActor } from "xstate";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDocumentMachine } from "@/v2/application";
import {
  createArtifactId,
  createDocumentId,
  createEditOperationId,
  createImageId,
  createManualDraftId,
  createRunId,
  type DocumentState,
} from "@/v2/domain";

import { useDocumentActorSelectors } from "./use-document-actor-selectors";

const documentId = createDocumentId("document-1");

function createPreparingDocument(): DocumentState {
  return {
    documentId,
    imageId: createImageId("image-1"),
    source: createArtifactId("source-1"),
    revision: 0,
    committed: null,
    baseline: null,
    activeRun: null,
    pendingCommit: null,
    pendingManualCommit: null,
    manualDraft: null,
    history: { past: [], future: [], retainedHistoricalBytes: 0 },
    status: "preparing",
    stage: null,
    progress: null,
    error: null,
  };
}

describe("useDocumentActorSelectors", () => {
  it("subscribes React only to narrow document view values", () => {
    const releaseDocument = vi.fn();
    const actor = createActor(
      createDocumentMachine({
        artifacts: {
          estimateHistoricalBytes() {
            return 0;
          },
          exportPng() {
            return undefined;
          },
          promoteRun() {
            return true;
          },
          releaseDocument,
          releaseRun() {
            return undefined;
          },
          releaseManualDraft() {},
          commitManualHistory() {},
          moveDocumentHistory() {},
        },
        cancellation: {
          create() {
            const controller = new AbortController();
            return { signal: controller.signal, abort: () => controller.abort() };
          },
        },
        gateway: {
          start() {
            throw new Error("Gateway must not start in this selector test");
          },
          dispose() {
            return Promise.resolve();
          },
        },
        runIds: { next: () => createRunId("run-1") },
        manualIds: {
          draft: () => createManualDraftId("draft-1"),
          operation: () => createEditOperationId("operation-1"),
        },
        manualCommitter: {
          commit: () => Promise.reject(new Error("Unexpected manual commit")),
        },
      }),
      { input: { document: createPreparingDocument() } },
    );
    actor.start();
    const rendered = renderHook(() => useDocumentActorSelectors(actor));

    expect(rendered.result.current).toEqual({
      status: "preparing",
      progress: null,
      error: null,
      lastCommandOutcome: null,
      manualDraft: null,
      canUndoDocument: false,
      canRedoDocument: false,
      revision: 0,
    });

    act(() => {
      actor.send({
        type: "DOMAIN_EVENT",
        event: {
          type: "PREPARATION_FAILED",
          documentId,
          error: { code: "decode-failed", message: "Invalid image", retryable: false },
        },
      });
    });
    expect(rendered.result.current).toMatchObject({
      status: "error",
      error: "Invalid image",
    });

    rendered.unmount();
    actor.stop();
    expect(releaseDocument).toHaveBeenCalledOnce();
  });
});
