import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { createActor } from "xstate";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDocumentMachine } from "@/editor/application";
import {
  createBackgroundDraftId,
  createEditOperationId,
  createEnhancementDraftId,
  createManualDraftId,
  createRunId,
} from "@/editor/domain";
import type { EditorSessionTypes } from "@/editor/runtime";
import { buildDocumentSnapshot, buildDocumentState } from "@/editor/testing";

import { ActiveDocument } from "./active-document";

afterEach(cleanup);

function backgroundActor(withDraft = true) {
  const committed = buildDocumentSnapshot();
  const state = buildDocumentState({
    revision: 1,
    committed,
    baseline: committed,
    status: "result",
    activeDraft: withDraft
      ? {
          kind: "background",
          draftId: createBackgroundDraftId("background-draft-1"),
          documentId: buildDocumentState().documentId,
          baselineRevision: 1,
          draftRevision: 1,
          fill: { type: "color", value: "#112233" },
          dirty: true,
          status: "ready",
        }
      : null,
  });
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
      finishingIds: {
        backgroundDraft: () => createBackgroundDraftId("background-draft-2"),
        enhancementDraft: () => createEnhancementDraftId("enhancement-draft-1"),
        operation: () => createEditOperationId("operation-2"),
      },
      manualCommitter: { commit: () => Promise.reject(new Error("unexpected")) },
    }),
    { input: { document: state } },
  );
  actor.start();
  return actor;
}

describe("ActiveDocument", () => {
  it("opens the default Magic tool once under StrictMode", () => {
    const actor = backgroundActor(false);
    const beginMagic = vi.fn();
    const session = {
      beginMagic,
      magicDraft: () => null,
      manualDraft: () => null,
      processingSelection: () => null,
      subscribeActive: () => () => undefined,
      workspaceSnapshot: () => ({ selectedDocumentId: buildDocumentState().documentId }),
    } as unknown as EditorSessionTypes.Session;
    const snapshot: EditorSessionTypes.ActiveSnapshot = {
      kind: "document",
      actor,
      error: null,
      fileName: "sample.png",
      foregroundUrl: "blob:foreground",
      height: 10,
      backgroundRuntime: { status: "ready", previewUrl: null, error: null },
      enhancementRuntime: {
        status: "ready",
        activeOperationId: null,
        fraction: null,
        error: null,
      },
      magicProgress: null,
      previewUrl: "blob:source",
      resultUrl: "blob:result",
      width: 10,
    };

    render(
      <StrictMode>
        <ActiveDocument
          locale="en"
          onLeave={vi.fn()}
          session={session}
          snapshot={snapshot}
        />
      </StrictMode>,
    );

    expect(beginMagic).toHaveBeenCalledOnce();
    actor.stop();
  });

  it("routes finishing shortcuts, guards dirty navigation, and blocks document history", () => {
    const actor = backgroundActor();
    const calls = {
      apply: vi.fn(),
      cancel: vi.fn(),
      undo: vi.fn(),
    };
    const session = {
      applyBackground: calls.apply,
      cancelBackground: calls.cancel,
      magicDraft: () => null,
      manualDraft: () => null,
      processingSelection: () => null,
      subscribeActive: () => () => undefined,
      workspaceSnapshot: () => ({ selectedDocumentId: buildDocumentState().documentId }),
      undoDocument: calls.undo,
    } as unknown as EditorSessionTypes.Session;
    const snapshot: EditorSessionTypes.ActiveSnapshot = {
      kind: "document",
      actor,
      error: null,
      fileName: "sample.png",
      foregroundUrl: "blob:foreground",
      height: 10,
      backgroundRuntime: { status: "ready", previewUrl: null, error: null },
      enhancementRuntime: {
        status: "ready",
        activeOperationId: null,
        fraction: null,
        error: null,
      },
      magicProgress: null,
      previewUrl: "blob:source",
      resultUrl: "blob:result",
      width: 10,
    };

    const view = render(
      <ActiveDocument
        locale="en"
        onLeave={vi.fn()}
        session={session}
        snapshot={snapshot}
      />,
    );

    expect(
      screen
        .getByRole("button", {
          name: /Undo document change|Отменить изменение документа/,
        })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(calls.undo).not.toHaveBeenCalled();
    expect(calls.apply).toHaveBeenCalledOnce();
    expect(calls.cancel).toHaveBeenCalledOnce();

    view.rerender(
      <ActiveDocument
        locale="en"
        onLeave={vi.fn()}
        session={session}
        snapshot={{
          ...snapshot,
          backgroundRuntime: {
            status: "preparing-image",
            previewUrl: null,
            error: null,
          },
        }}
      />,
    );
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(calls.apply).toHaveBeenCalledOnce();

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    actor.stop();
  });
});
