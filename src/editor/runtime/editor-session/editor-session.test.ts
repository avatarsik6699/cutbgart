import { describe, expect, it, vi } from "vitest";

import type {
  EnhancementCommitter,
  ProcessingGateway,
  ProcessingRun,
  ProcessingTerminalOutcome,
} from "@/editor/application";
import {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
  createEditOperationId,
  createEnhancementDraftId,
  createImageId,
  createManualDraftId,
  createMagicDraftId,
  createMagicCandidateId,
  createRunId,
  type DocumentSnapshot,
  type ProcessingProgress,
  type ProcessingRequest,
} from "@/editor/domain";

import { ArtifactRepository } from "../artifacts";
import type { EnhancementRuntimeService } from "../enhancements";
import { createEditorSession } from "./editor-session";
import type { EditorSessionTypes } from "./editor-session.types";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function pngFile(name = "portrait.png"): File {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 1);
  view.setUint32(20, 1);
  return new File([bytes], name, { type: "image/png" });
}

function createGatewayHarness() {
  const terminals = [deferred<ProcessingTerminalOutcome>()];
  const listeners = new Set<(progress: ProcessingProgress) => void>();
  const requests: ProcessingRequest[] = [];
  const dispose = vi.fn(() => Promise.resolve());
  const gateway: ProcessingGateway = {
    start(nextRequest) {
      const index = requests.length;
      const terminal = terminals[index] ?? deferred<ProcessingTerminalOutcome>();
      terminals[index] = terminal;
      requests.push(nextRequest);
      const result = terminal.promise.then((outcome) => {
        if (outcome.type === "succeeded") {
          return outcome.snapshot;
        }
        throw new Error(outcome.type === "failed" ? outcome.error.message : "cancelled");
      });
      void result.catch(() => undefined);
      return {
        runId: nextRequest.runId,
        result,
        terminal: terminal.promise,
        cancel() {
          terminal.resolve({ type: "cancelled" });
        },
        release() {},
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      } satisfies ProcessingRun;
    },
    dispose,
  };
  return {
    dispose,
    gateway,
    publish(progress: ProcessingProgress) {
      for (const listener of listeners) listener(progress);
    },
    request: () => requests.at(-1) ?? null,
    requestAt: (index: number) => requests[index] ?? null,
    terminal: terminals[0]!,
    terminalAt(index: number) {
      const terminal = terminals[index] ?? deferred<ProcessingTerminalOutcome>();
      terminals[index] = terminal;
      return terminal;
    },
  };
}

function createHarness(
  runtimeOptions: (
    repository: ArtifactRepository,
  ) => Partial<EditorSessionTypes.Options> = () => ({}),
) {
  let nextArtifact = 0;
  let nextUrl = 0;
  const revoke = vi.fn();
  const repository = new ArtifactRepository({
    assertions: "throw",
    idSource: { next: () => createArtifactId(`artifact-${++nextArtifact}`) },
    memoryBudgetBytes: 1024 * 1024,
    urlAdapter: { create: () => `blob:test-${++nextUrl}`, revoke },
  });
  const gateway = createGatewayHarness();
  const download = { start: vi.fn() };
  const session = createEditorSession({
    download,
    gateway: gateway.gateway,
    ids: {
      artifact: () => createArtifactId("unused-artifact"),
      document: () => createDocumentId("document-1"),
      image: () => createImageId("image-1"),
      run: () => createRunId("run-1"),
      manualDraft: () => createManualDraftId("draft-1"),
      magicDraft: () => createMagicDraftId("magic-draft-1"),
      magicCandidate: () => createMagicCandidateId("magic-candidate-1"),
      backgroundDraft: () => createBackgroundDraftId("background-draft-1"),
      enhancementDraft: () => createEnhancementDraftId("enhancement-draft-1"),
      editOperation: () => createEditOperationId("operation-1"),
    },
    repository,
    ...runtimeOptions(repository),
  });
  return { download, gateway, repository, revoke, session };
}

function enhancementRuntime(
  commit: EnhancementCommitter["commit"],
): EnhancementRuntimeService {
  return {
    commit,
    dispose() {},
    getSnapshot: () => ({
      status: "ready",
      activeOperationId: null,
      fraction: null,
      error: null,
    }),
    reportError: vi.fn(),
    reset: vi.fn(),
    subscribe: () => () => undefined,
  };
}

describe("editor browser session", () => {
  it("caches workspace snapshot identity until the session publishes a change", async () => {
    const harness = createHarness();
    const initial = harness.session.workspaceSnapshot();
    expect(harness.session.workspaceSnapshot()).toBe(initial);

    await harness.session.importImage(
      new File([new Uint8Array([1, 2, 3])], "broken.png", { type: "image/png" }),
    );

    const changed = harness.session.workspaceSnapshot();
    expect(changed).not.toBe(initial);
    expect(harness.session.workspaceSnapshot()).toBe(changed);
    await harness.session.dispose();
  });

  it("owns import, actor processing, committed preview, export, and reset lifetimes", async () => {
    const harness = createHarness();
    await harness.session.importImage(pngFile());
    const request = harness.gateway.request();
    expect(request).not.toBeNull();
    if (request === null) return;
    expect(harness.session.getSnapshot()).toMatchObject({
      kind: "document",
      fileName: "portrait.png",
      previewUrl: "blob:test-1",
    });

    harness.gateway.publish({ ...request, stage: "automatic-remove", fraction: 0.5 });
    const active = harness.session.getSnapshot();
    expect(active.kind).toBe("document");
    if (active.kind !== "document") return;
    expect(active.actor.getSnapshot().context.document.status).toBe("processing");
    const owner = {
      kind: "run",
      documentId: request.documentId,
      runId: request.runId,
    } as const;
    const matte = harness.repository.register(
      new Uint8ClampedArray([255]),
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: 1,
        height: 1,
        estimatedBytes: 1,
      },
      owner,
    );
    const composite = harness.repository.register(
      new Blob(["png"], { type: "image/png" }),
      {
        kind: "composite",
        mediaType: "image/png",
        width: 1,
        height: 1,
        estimatedBytes: 3,
      },
      owner,
    );
    const result: DocumentSnapshot = {
      automaticModelMode: "isnet-q8",
      matte,
      foreground: null,
      composite,
      background: { type: "transparent" },
    };
    harness.gateway.terminal.resolve({ type: "succeeded", snapshot: result });
    await vi.waitFor(() =>
      expect(active.actor.getSnapshot().context.document.status).toBe("result"),
    );
    expect(harness.session.getSnapshot().resultUrl).toBe("blob:test-2");

    const workspaceListener = vi.fn();
    const activeListener = vi.fn();
    const stopWorkspace = harness.session.subscribe(workspaceListener);
    const stopActive = harness.session.subscribeActive(activeListener);
    harness.session.beginMagic();
    expect(workspaceListener).toHaveBeenCalled();
    expect(activeListener).not.toHaveBeenCalled();
    harness.session.cancelMagic();
    stopWorkspace();
    stopActive();

    void harness.session.exportPng();
    expect(harness.download.start).toHaveBeenCalledWith(
      "blob:test-3",
      "cutbg-result.png",
    );
    await Promise.resolve();

    harness.session.reset();
    expect(harness.session.getSnapshot()).toMatchObject({ actor: null, kind: "empty" });
    harness.repository.assertEmpty();
    expect(harness.revoke).toHaveBeenCalledTimes(3);
    await harness.session.dispose();
    expect(harness.gateway.dispose).toHaveBeenCalledOnce();
  });

  it("rejects invalid encoded input before allocating a document", async () => {
    const harness = createHarness();
    await harness.session.importImage(
      new File([new Uint8Array([1, 2, 3])], "broken.png", { type: "image/png" }),
    );

    expect(harness.session.getSnapshot()).toMatchObject({
      actor: null,
      error: "invalid-image",
    });
    expect(harness.gateway.request()).toBeNull();
    harness.session.reset();
    expect(harness.session.workspaceSnapshot().items).toHaveLength(0);
    harness.repository.assertEmpty();
    await harness.session.dispose();
  });

  it("correlates BEN2 fallback to the effective WASM model selected by runtime", async () => {
    const harness = createHarness();

    await harness.session.importImage(pngFile(), "ben2-fp16");

    expect(harness.session.processingSelection()).toEqual({
      effectiveMode: "isnet-fp32",
      fallbackUsed: true,
      inferencePath: "wasm",
      requestedMode: "ben2-fp16",
    });
    const request = harness.gateway.request();
    expect(request).toMatchObject({ modelMode: "isnet-fp32" });
    if (request === null) throw new Error("Processing request is unavailable");
    harness.gateway.publish({ ...request, stage: "model-loading", fraction: 0.25 });
    expect(harness.session.workspaceSnapshot().items[0]).toMatchObject({
      qualityMode: "isnet-fp32",
      status: "model-loading",
    });
    harness.session.reset();
    await harness.session.dispose();
  });

  it("reprocesses only the selected result with an available model and preserves cancel", async () => {
    const harness = createHarness();
    await harness.session.importImage(pngFile(), "isnet-q8");

    function completeRun(index: number, mode: DocumentSnapshot["automaticModelMode"]) {
      const request = harness.gateway.requestAt(index);
      if (request === null) throw new Error("Processing request is unavailable");
      const owner = {
        kind: "run",
        documentId: request.documentId,
        runId: request.runId,
      } as const;
      const matte = harness.repository.register(
        new Uint8ClampedArray([255]),
        {
          kind: "matte",
          mediaType: "application/octet-stream",
          width: 1,
          height: 1,
          estimatedBytes: 1,
        },
        owner,
      );
      const composite = harness.repository.register(
        new Blob([mode], { type: "image/png" }),
        {
          kind: "composite",
          mediaType: "image/png",
          width: 1,
          height: 1,
          estimatedBytes: mode.length,
        },
        owner,
      );
      harness.gateway.terminalAt(index).resolve({
        type: "succeeded",
        snapshot: {
          automaticModelMode: mode,
          matte,
          foreground: null,
          composite,
          background: { type: "transparent" },
        },
      });
    }

    completeRun(0, "isnet-q8");
    const active = harness.session.getSnapshot();
    if (active.kind !== "document") throw new Error("Document was not prepared");
    await vi.waitFor(() => expect(harness.session.currentModelMode()).toBe("isnet-q8"));
    expect(harness.session.availableModelModes()).toEqual(["isnet-q8", "isnet-fp32"]);
    expect(harness.session.reprocess("ben2-fp16")).toBe(false);
    expect(harness.session.reprocess("isnet-fp32")).toBe(true);
    expect(harness.gateway.requestAt(1)).toMatchObject({
      documentId: active.actor.getSnapshot().context.document.documentId,
      source: active.actor.getSnapshot().context.document.source,
      modelMode: "isnet-fp32",
    });
    harness.session.cancel();
    await vi.waitFor(() =>
      expect(active.actor.getSnapshot().context.document.status).toBe("result"),
    );
    expect(harness.session.currentModelMode()).toBe("isnet-q8");
    expect(active.actor.getSnapshot().context.document.history.past).toHaveLength(0);

    expect(harness.session.reprocess("isnet-fp32")).toBe(true);
    completeRun(2, "isnet-fp32");
    await vi.waitFor(() => expect(harness.session.currentModelMode()).toBe("isnet-fp32"));
    expect(active.actor.getSnapshot().context.document.history.past).toMatchObject([
      { kind: "automatic-remove" },
    ]);
    harness.session.undoDocument();
    expect(harness.session.currentModelMode()).toBe("isnet-q8");
    harness.session.redoDocument();
    expect(harness.session.currentModelMode()).toBe("isnet-fp32");

    harness.session.reset();
    harness.repository.assertEmpty();
    await harness.session.dispose();
  });

  it("caps live import items at twenty and keeps every invalid sibling independently retryable", async () => {
    const harness = createHarness();
    const files = Array.from(
      { length: 21 },
      (_, index) =>
        new File(["invalid"], `invalid-${index + 1}.txt`, { type: "text/plain" }),
    );
    await harness.session.importImages(files);
    const workspace = harness.session.workspaceSnapshot();
    expect(workspace.items).toHaveLength(20);
    expect(workspace.items.every((item) => item.status === "error")).toBe(true);
    expect(workspace.items.every((item) => item.qualityMode === "isnet-q8")).toBe(true);
    expect(new Set(workspace.itemIds).size).toBe(20);
    harness.repository.assertEmpty();
    await harness.session.dispose();
  });

  it("delegates Background and Enhancement lifecycles without adding pixels to session state", async () => {
    const backgroundCommit = vi.fn();
    const enhancementCommit = vi.fn(() =>
      Promise.resolve({ outcome: "unchanged" as const }),
    );
    const harness = createHarness((repository) => ({
      backgroundCommitter: {
        commit(input) {
          backgroundCommit(input);
          const owner = {
            kind: "background-draft",
            documentId: input.documentId,
            draftId: input.draftId,
          } as const;
          const composite = repository.register(
            new Blob(["background-result"], { type: "image/png" }),
            {
              kind: "composite",
              mediaType: "image/png",
              width: 1,
              height: 1,
              estimatedBytes: 17,
            },
            owner,
          );
          return Promise.resolve({
            ...input.snapshot,
            composite,
            background: input.fill,
          });
        },
      },
      enhancementService: enhancementRuntime(enhancementCommit),
    }));
    await harness.session.importImage(pngFile());
    const request = harness.gateway.request();
    const active = harness.session.getSnapshot();
    if (request === null || active.kind !== "document")
      throw new Error("Document was not prepared");
    const runOwner = {
      kind: "run",
      documentId: request.documentId,
      runId: request.runId,
    } as const;
    const matte = harness.repository.register(
      new Uint8ClampedArray([255]),
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: 1,
        height: 1,
        estimatedBytes: 1,
      },
      runOwner,
    );
    const composite = harness.repository.register(
      new Blob(["automatic"], { type: "image/png" }),
      {
        kind: "composite",
        mediaType: "image/png",
        width: 1,
        height: 1,
        estimatedBytes: 9,
      },
      runOwner,
    );
    harness.gateway.terminal.resolve({
      type: "succeeded",
      snapshot: {
        automaticModelMode: "isnet-q8",
        matte,
        foreground: null,
        composite,
        background: { type: "transparent" },
      },
    });
    await vi.waitFor(() =>
      expect(active.actor.getSnapshot().context.document.revision).toBe(1),
    );

    harness.session.beginBackground();
    harness.session.changeBackground({ type: "color", value: "#112233" });
    expect(harness.session.getSnapshot()).toMatchObject({
      backgroundRuntime: { status: "ready", previewUrl: null },
    });
    harness.session.applyBackground();
    await vi.waitFor(() =>
      expect(active.actor.getSnapshot().context.document.revision).toBe(2),
    );
    expect(backgroundCommit).toHaveBeenCalledOnce();
    expect(active.actor.getSnapshot().context.document).toMatchObject({
      committed: { background: { type: "color", value: "#112233" } },
      activeDraft: null,
    });

    harness.session.beginEnhancements();
    harness.session.changeEnhancements(["colour-halo", "fine-detail"]);
    harness.session.applyEnhancements();
    await vi.waitFor(() => expect(enhancementCommit).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(active.actor.getSnapshot().context.document.status).toBe("result"),
    );
    expect(active.actor.getSnapshot().context.document).toMatchObject({
      revision: 2,
      activeDraft: { kind: "enhance", status: "ready" },
    });
    expect(active.actor.getSnapshot().context.document.history.past).toHaveLength(1);
    harness.session.cancelEnhancements();
    expect(active.actor.getSnapshot().context.document.activeDraft).toBeNull();

    harness.session.reset();
    harness.repository.assertEmpty();
    await harness.session.dispose();
  });
});
