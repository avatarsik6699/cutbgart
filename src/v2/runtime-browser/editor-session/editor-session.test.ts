import { describe, expect, it, vi } from "vitest";

import type {
  ProcessingGateway,
  ProcessingRun,
  ProcessingTerminalOutcome,
} from "@/v2/application";
import {
  createArtifactId,
  createDocumentId,
  createEditOperationId,
  createImageId,
  createManualDraftId,
  createRunId,
  type DocumentSnapshot,
  type ProcessingProgress,
  type ProcessingRequest,
} from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";
import { createEditorSession } from "./editor-session";

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
  const terminal = deferred<ProcessingTerminalOutcome>();
  const listeners = new Set<(progress: ProcessingProgress) => void>();
  let request: ProcessingRequest | null = null;
  const dispose = vi.fn(() => Promise.resolve());
  const gateway: ProcessingGateway = {
    start(nextRequest) {
      request = nextRequest;
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
    request: () => request,
    terminal,
  };
}

function createHarness() {
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
      editOperation: () => createEditOperationId("operation-1"),
    },
    repository,
  });
  return { download, gateway, repository, revoke, session };
}

describe("editor v2 browser session", () => {
  it("owns import, actor processing, committed preview, export, and reset lifetimes", async () => {
    const harness = createHarness();
    await Promise.all([
      harness.session.importImage(pngFile()),
      harness.session.importImage(pngFile("ignored-second.png")),
    ]);
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
    const result: DocumentSnapshot = { matte, foreground: null, composite };
    harness.gateway.terminal.resolve({ type: "succeeded", snapshot: result });
    await vi.waitFor(() =>
      expect(active.actor.getSnapshot().context.document.status).toBe("result"),
    );
    expect(harness.session.getSnapshot().resultUrl).toBe("blob:test-2");

    harness.session.exportPng();
    expect(harness.download.start).toHaveBeenCalledWith(
      "blob:test-3",
      "portrait-no-background.png",
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
    harness.repository.assertEmpty();
    await harness.session.dispose();
  });
});
