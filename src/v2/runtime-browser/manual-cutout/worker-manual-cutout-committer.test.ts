import { describe, expect, it, vi } from "vitest";

import { createArtifactId, createDocumentId, createManualDraftId } from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";
import { SNAPSHOT_COMMIT_PROTOCOL_VERSION } from "../snapshot-commit";
import {
  WorkerManualCutoutCommitter,
  type ManualCutoutWorkerFactory,
} from "./worker-manual-cutout-committer";

class FakeManualWorker extends EventTarget {
  readonly postMessage = vi.fn<(message: unknown, transfer?: Transferable[]) => void>();
  readonly terminate = vi.fn();

  succeed(correlation: {
    documentId: ReturnType<typeof createDocumentId>;
    draftId: ReturnType<typeof createManualDraftId>;
    expectedRevision: number;
  }): void {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
          type: "SUCCEEDED",
          correlation: { ...correlation, operation: "manual-cutout" },
          compositePng: new Uint8Array([1, 2, 3]).buffer,
        },
      }),
    );
  }
}

function harness() {
  let id = 0;
  const repository = new ArtifactRepository({
    idSource: { next: () => createArtifactId(`artifact-${++id}`) },
    memoryBudgetBytes: 1024,
    urlAdapter: { create: () => "blob:test", revoke: vi.fn() },
  });
  const documentId = createDocumentId("document-1");
  const draftId = createManualDraftId("draft-1");
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
    new Uint8ClampedArray([0]),
    {
      kind: "matte",
      mediaType: "application/octet-stream",
      width: 1,
      height: 1,
      estimatedBytes: 1,
    },
    { kind: "manual-draft", documentId, draftId },
  );
  const worker = new FakeManualWorker();
  const factory = { create: () => worker } as unknown as ManualCutoutWorkerFactory;
  const committer = new WorkerManualCutoutCommitter(repository, factory);
  return { committer, documentId, draftId, draftMatte, repository, source, worker };
}

describe("WorkerManualCutoutCommitter", () => {
  it("transfers source/matte through the no-inference protocol and correlates one snapshot", async () => {
    const test = harness();
    const request = {
      documentId: test.documentId,
      draftId: test.draftId,
      expectedRevision: 3,
      source: test.source,
      draftMatte: test.draftMatte,
    };
    const result = test.committer.commit(request, new AbortController().signal);
    await vi.waitFor(() => expect(test.worker.postMessage).toHaveBeenCalledOnce());
    const command = test.worker.postMessage.mock.calls[0]?.[0];
    expect(command).toMatchObject({
      type: "MATERIALIZE_SNAPSHOT",
      correlation: {
        documentId: test.documentId,
        draftId: test.draftId,
        expectedRevision: 3,
        operation: "manual-cutout",
      },
    });
    expect(command).not.toHaveProperty("model");
    test.worker.succeed(request);
    await expect(result).resolves.toMatchObject({
      matte: test.draftMatte,
      foreground: null,
    });
    expect(test.worker.terminate).toHaveBeenCalledOnce();
    test.repository.dispose();
  });

  it("terminates and rejects a cancelled commit without registering an output", async () => {
    const test = harness();
    const controller = new AbortController();
    const result = test.committer.commit(
      {
        documentId: test.documentId,
        draftId: test.draftId,
        expectedRevision: 0,
        source: test.source,
        draftMatte: test.draftMatte,
      },
      controller.signal,
    );
    await vi.waitFor(() => expect(test.worker.postMessage).toHaveBeenCalledOnce());
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(test.repository.stats().artifacts).toBe(2);
    test.repository.dispose();
  });
});
