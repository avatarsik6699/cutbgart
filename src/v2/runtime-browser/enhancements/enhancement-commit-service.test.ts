import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createEnhancementDraftId,
  createRunId,
} from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";
import { HeavyJobCoordinator } from "../processing";
import type { SnapshotCommitter } from "../snapshot-commit";
import { EnhancementCommitService } from "./enhancement-commit-service";
import { EnhancementDraftRepository } from "./enhancement-draft-repository";
import type { EnhancementOperationRunner } from "./enhancement-worker-client";

function operationRunner(
  run: EnhancementOperationRunner["run"],
): EnhancementOperationRunner {
  return { run, reset: vi.fn(), dispose: vi.fn() };
}

function harness() {
  let next = 0;
  const documentId = createDocumentId("document-1");
  const repository = new ArtifactRepository({
    idSource: { next: () => createArtifactId(`enhancement-${++next}`) },
    memoryBudgetBytes: 4096,
  });
  const documentOwner = { kind: "document", documentId } as const;
  const source = repository.register(
    new Blob(["source"], { type: "image/png" }),
    {
      kind: "source",
      mediaType: "image/png",
      width: 2,
      height: 1,
      estimatedBytes: 6,
    },
    documentOwner,
  );
  const matte = repository.register(
    new Uint8ClampedArray([10, 20]),
    {
      kind: "matte",
      mediaType: "application/octet-stream",
      width: 2,
      height: 1,
      estimatedBytes: 2,
    },
    documentOwner,
  );
  const composite = repository.register(
    new Blob(["before"], { type: "image/png" }),
    {
      kind: "composite",
      mediaType: "image/png",
      width: 2,
      height: 1,
      estimatedBytes: 6,
    },
    documentOwner,
  );
  const snapshot = {
    matte,
    foreground: null,
    composite,
    background: { type: "transparent" } as const,
  };
  const draftId = createEnhancementDraftId("enhancement-draft-1");
  const drafts = new EnhancementDraftRepository(repository);
  drafts.capture({
    documentId,
    draftId,
    baselineRevision: 3,
    source,
    snapshot,
  });
  return { documentId, repository, source, snapshot, draftId, drafts };
}

describe("EnhancementCommitService", () => {
  it("runs registry order, materializes once, and promotes one atomic changed result", async () => {
    const subject = harness();
    const run = vi
      .fn<EnhancementOperationRunner["run"]>()
      .mockImplementationOnce(() =>
        Promise.resolve({
          operationId: "fine-detail",
          matte: new Uint8ClampedArray([11, 20]),
          changed: true,
          actualMode: "balanced",
          actualPath: "wasm",
          fallback: "none",
        }),
      )
      .mockImplementationOnce((input) =>
        Promise.resolve({
          operationId: "colour-halo",
          matte: input.matte,
          foreground: new Blob(["foreground"], { type: "image/png" }),
          changed: true,
          actualPath: "decontaminate",
          fallback: "none",
        }),
      );
    const commit = vi.fn<SnapshotCommitter["commit"]>((request, owner) => {
      const composite = subject.repository.register(
        new Blob(["after"], { type: "image/png" }),
        {
          kind: "composite",
          mediaType: "image/png",
          width: 2,
          height: 1,
          estimatedBytes: 5,
        },
        owner,
      );
      return Promise.resolve({
        matte: request.draftMatte,
        foreground: request.foreground ?? null,
        composite,
        background: request.background,
      });
    });
    const service = new EnhancementCommitService({
      artifacts: subject.repository,
      coordinator: new HeavyJobCoordinator(),
      drafts: subject.drafts,
      requestedPath: () => "wasm",
      snapshots: { commit },
      worker: operationRunner(run),
    });
    const runtimeListener = vi.fn();
    service.subscribe(runtimeListener);
    const runId = createRunId("enhancement-run-1");
    const result = await service.commit(
      {
        documentId: subject.documentId,
        draftId: subject.draftId,
        runId,
        expectedRevision: 3,
        source: subject.source,
        snapshot: subject.snapshot,
        operationIds: ["colour-halo", "fine-detail"],
      },
      new AbortController().signal,
    );
    expect(run.mock.calls.map(([input]) => input.operationId)).toEqual([
      "fine-detail",
      "colour-halo",
    ]);
    expect(run.mock.calls[1]?.[0].matte).toEqual(new Uint8ClampedArray([11, 20]));
    expect(commit).toHaveBeenCalledOnce();
    expect(result.outcome).toBe("changed");
    if (result.outcome !== "changed") throw new Error("Enhancement did not commit");
    expect(result.snapshot.background).toEqual({ type: "transparent" });
    expect(typeof result.snapshot.foreground).toBe("string");
    expect(service.getSnapshot()).toEqual({
      status: "ready",
      activeOperationId: null,
      fraction: null,
      error: null,
    });
    expect(runtimeListener).toHaveBeenCalled();
    subject.drafts.release(subject.documentId, subject.draftId);
    expect(subject.repository.stats()).toMatchObject({ artifacts: 3, leases: 3 });
  });

  it("publishes no-change without encoding or registering run artifacts", async () => {
    const subject = harness();
    const run = vi.fn<EnhancementOperationRunner["run"]>((input) =>
      Promise.resolve({
        operationId: "fine-detail",
        matte: input.matte.slice(),
        changed: false,
        actualMode: "deterministic",
        actualPath: null,
        fallback: "deterministic",
      }),
    );
    const commit = vi.fn<SnapshotCommitter["commit"]>();
    const service = new EnhancementCommitService({
      artifacts: subject.repository,
      coordinator: new HeavyJobCoordinator(),
      drafts: subject.drafts,
      requestedPath: () => "wasm",
      snapshots: { commit },
      worker: operationRunner(run),
    });
    await expect(
      service.commit(
        {
          documentId: subject.documentId,
          draftId: subject.draftId,
          runId: createRunId("enhancement-run-1"),
          expectedRevision: 3,
          source: subject.source,
          snapshot: subject.snapshot,
          operationIds: ["fine-detail"],
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ outcome: "unchanged" });
    expect(commit).not.toHaveBeenCalled();
    expect(subject.repository.stats()).toMatchObject({ artifacts: 3, leases: 6 });
    expect(service.getSnapshot().status).toBe("no-change");
  });
});
