import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createMagicCandidateId,
  createMagicDraftId,
  createRunId,
} from "@/editor/domain";

import { ArtifactRepository } from "../artifacts";
import {
  SNAPSHOT_COMMIT_PROTOCOL_VERSION,
  WorkerSnapshotCommitter,
  type SnapshotCommitWorker,
  type SnapshotCommitWorkerCommand,
  type SnapshotCommitWorkerEvent,
} from "../snapshot-commit";
import { MagicCandidateRepository } from "./magic-candidate-repository";
import { WorkerMagicCutoutCommitter } from "./worker-magic-cutout-committer";

class FakeSnapshotWorker implements SnapshotCommitWorker {
  readonly messages: SnapshotCommitWorkerCommand[] = [];
  readonly terminate = vi.fn();
  readonly #errorListeners = new Set<(event: Event) => void>();
  readonly #messageListeners = new Set<(event: MessageEvent<unknown>) => void>();

  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  addEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: ((event: MessageEvent<unknown>) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      this.#messageListeners.add(listener);
    } else {
      this.#errorListeners.add(listener as (event: Event) => void);
    }
  }

  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: "error" | "messageerror",
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: "message" | "error" | "messageerror",
    listener: ((event: MessageEvent<unknown>) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      this.#messageListeners.delete(listener);
    } else {
      this.#errorListeners.delete(listener as (event: Event) => void);
    }
  }

  postMessage(message: SnapshotCommitWorkerCommand): void {
    this.messages.push(message);
  }

  succeed(correlation: SnapshotCommitWorkerEvent["correlation"]): void {
    for (const listener of this.#messageListeners) {
      listener(
        new MessageEvent("message", {
          data: {
            protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
            type: "SUCCEEDED",
            correlation,
            compositePng: new Uint8Array([1, 2, 3]).buffer,
          } satisfies SnapshotCommitWorkerEvent,
        }),
      );
    }
  }
}

function createHarness() {
  let nextArtifact = 0;
  const documentId = createDocumentId("document-1");
  const draftId = createMagicDraftId("draft-1");
  const candidateId = createMagicCandidateId("candidate-1");
  const repository = new ArtifactRepository({
    idSource: { next: () => createArtifactId(`artifact-${++nextArtifact}`) },
    memoryBudgetBytes: 1024,
  });
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
  const candidates = new MagicCandidateRepository(() => candidateId);
  candidates.replace({
    base: null,
    correlation: {
      documentId,
      draftId,
      runId: createRunId("run-1"),
      expectedRevision: 2,
      draftRevision: 3,
    },
    raw: [{ data: new Uint8ClampedArray([255]).buffer, width: 1, height: 1, score: 1 }],
    source,
    strokes: [{ id: "keep", mode: "keep", radius: 1, points: [{ x: 0, y: 0 }] }],
  });
  const worker = new FakeSnapshotWorker();
  const snapshots = new WorkerSnapshotCommitter(repository, { create: () => worker });
  const committer = new WorkerMagicCutoutCommitter({
    candidates,
    repository,
    snapshots,
  });
  const input = {
    documentId,
    draftId,
    candidateId,
    expectedRevision: 2,
    draftRevision: 3,
    foreground: null,
    background: { type: "transparent" },
  } as const;
  return { committer, input, repository, worker };
}

describe("WorkerMagicCutoutCommitter", () => {
  it("materializes the selected runtime candidate without inference", async () => {
    const harness = createHarness();
    const result = harness.committer.commit(harness.input, new AbortController().signal);
    await vi.waitFor(() => expect(harness.worker.messages).toHaveLength(1));
    const command = harness.worker.messages[0]!;

    expect(command).toMatchObject({
      type: "MATERIALIZE_SNAPSHOT",
      correlation: {
        documentId: harness.input.documentId,
        draftId: harness.input.draftId,
        expectedRevision: 2,
        operation: "magic-cutout",
      },
    });
    expect(command).not.toHaveProperty("model");
    harness.worker.succeed(command.correlation);
    await expect(result).resolves.toMatchObject({ foreground: null });
    expect(harness.repository.stats().artifacts).toBe(3);
  });

  it("rejects a stale candidate before creating commit artifacts", async () => {
    const harness = createHarness();

    await expect(
      harness.committer.commit(
        { ...harness.input, draftRevision: 4 },
        new AbortController().signal,
      ),
    ).rejects.toThrow("stale");
    expect(harness.worker.messages).toHaveLength(0);
    expect(harness.repository.stats().artifacts).toBe(1);
  });
});
