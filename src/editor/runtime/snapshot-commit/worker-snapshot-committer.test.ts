import { describe, expect, it, vi } from "vitest";

import { createArtifactId, createDocumentId, createManualDraftId } from "@/editor/domain";

import { ArtifactRepository } from "../artifacts";
import {
  SNAPSHOT_COMMIT_PROTOCOL_VERSION,
  type SnapshotCommitWorkerCommand,
} from "./snapshot-commit-protocol";
import {
  WorkerSnapshotCommitter,
  type SnapshotCommitWorker,
} from "./worker-snapshot-committer";

class FakeWorker extends EventTarget {
  readonly messages: SnapshotCommitWorkerCommand[] = [];
  readonly transfers: Transferable[][] = [];
  readonly terminate = vi.fn();
  postError: Error | null = null;

  postMessage(message: SnapshotCommitWorkerCommand, transfer: Transferable[]): void {
    if (this.postError !== null) throw this.postError;
    this.messages.push(message);
    this.transfers.push(transfer);
  }

  emitMessage(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  crash(message: string): void {
    const event = new Event("error");
    Object.defineProperty(event, "message", { value: message });
    this.dispatchEvent(event);
  }
}

function createHarness() {
  let nextArtifact = 0;
  const documentId = createDocumentId("document-1");
  const draftId = createManualDraftId("draft-1");
  const repository = new ArtifactRepository({
    idSource: { next: () => createArtifactId(`artifact-${++nextArtifact}`) },
    memoryBudgetBytes: 1024,
  });
  const owner = { kind: "manual-draft", documentId, draftId } as const;
  const source = repository.register(
    new Blob([new Uint8Array([1])], { type: "image/png" }),
    {
      kind: "source",
      mediaType: "image/png",
      width: 1,
      height: 1,
      estimatedBytes: 1,
    },
    { kind: "document", documentId },
  );
  const draftMatte = repository.register(
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
  const worker = new FakeWorker();
  const committer = new WorkerSnapshotCommitter(repository, {
    create: () => worker as unknown as SnapshotCommitWorker,
  });
  const request = {
    documentId,
    draftId,
    expectedRevision: 1,
    operation: "manual-cutout",
    source,
    draftMatte,
    background: { type: "transparent" },
  } as const;
  return { committer, owner, repository, request, worker };
}

describe("WorkerSnapshotCommitter lifecycle", () => {
  it("rejects malformed or version-mismatched events and terminates the worker", async () => {
    const harness = createHarness();
    const result = harness.committer.commit(
      harness.request,
      harness.owner,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(harness.worker.messages).toHaveLength(1));

    harness.worker.emitMessage({
      protocol: 999,
      type: "SUCCEEDED",
      correlation: harness.request,
      compositePng: new ArrayBuffer(0),
    });

    await expect(result).rejects.toThrow("Invalid snapshot commit worker event");
    expect(harness.worker.terminate).toHaveBeenCalledOnce();
    expect(harness.repository.stats().artifacts).toBe(2);
  });

  it("rejects a worker crash and cleans up deterministically", async () => {
    const harness = createHarness();
    const result = harness.committer.commit(
      harness.request,
      harness.owner,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(harness.worker.messages).toHaveLength(1));

    harness.worker.crash("snapshot boom");

    await expect(result).rejects.toThrow("snapshot boom");
    expect(harness.worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates when command transfer fails synchronously", async () => {
    const harness = createHarness();
    harness.worker.postError = new Error("transfer failed");

    await expect(
      harness.committer.commit(
        harness.request,
        harness.owner,
        new AbortController().signal,
      ),
    ).rejects.toThrow("transfer failed");
    expect(harness.worker.terminate).toHaveBeenCalledOnce();
  });

  it("ignores foreign correlations before accepting the matching result", async () => {
    const harness = createHarness();
    const result = harness.committer.commit(
      harness.request,
      harness.owner,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(harness.worker.messages).toHaveLength(1));
    harness.worker.emitMessage({
      protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: { ...harness.request, expectedRevision: 2 },
      compositePng: new Uint8Array([9]).buffer,
    });
    expect(harness.worker.terminate).not.toHaveBeenCalled();

    harness.worker.emitMessage({
      protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: harness.request,
      compositePng: new Uint8Array([1, 2, 3]).buffer,
    });

    await expect(result).resolves.toMatchObject({ foreground: null });
    expect(harness.worker.terminate).toHaveBeenCalledOnce();
  });

  it("transfers an optional foreground and keeps it in the committed snapshot", async () => {
    const harness = createHarness();
    const foreground = harness.repository.register(
      new Blob([new Uint8Array([2])], { type: "image/webp" }),
      {
        kind: "foreground",
        mediaType: "image/webp",
        width: 1,
        height: 1,
        estimatedBytes: 1,
      },
      harness.owner,
    );
    const request = {
      ...harness.request,
      foreground,
      background: { type: "color", value: "#112233" },
    } as const;
    const result = harness.committer.commit(
      request,
      harness.owner,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(harness.worker.messages).toHaveLength(1));
    expect(harness.worker.messages[0]).toMatchObject({
      foreground: { mediaType: "image/webp" },
      background: { type: "color", value: "#112233" },
    });
    expect(harness.worker.transfers[0]).toHaveLength(3);
    harness.worker.emitMessage({
      protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: request,
      compositePng: new Uint8Array([1]).buffer,
    });
    await expect(result).resolves.toMatchObject({
      foreground,
      background: request.background,
    });
  });

  it("resolves an artifact-backed background into transferable worker bytes", async () => {
    const harness = createHarness();
    const background = harness.repository.register(
      new Blob([new Uint8Array([3])], { type: "image/jpeg" }),
      {
        kind: "background-image",
        mediaType: "image/jpeg",
        width: 1,
        height: 1,
        estimatedBytes: 1,
      },
      harness.owner,
    );
    const request = {
      ...harness.request,
      background: { type: "image", artifactId: background },
    } as const;
    const result = harness.committer.commit(
      request,
      harness.owner,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(harness.worker.messages).toHaveLength(1));
    expect(harness.worker.messages[0]).toMatchObject({
      background: { type: "image", mediaType: "image/jpeg" },
    });
    expect(harness.worker.transfers[0]).toHaveLength(3);
    harness.worker.emitMessage({
      protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: request,
      compositePng: new Uint8Array([1]).buffer,
    });
    await expect(result).resolves.toMatchObject({ background: request.background });
  });
});
