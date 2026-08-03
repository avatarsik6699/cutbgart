import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createEditOperationId,
  createManualDraftId,
} from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";

import { createEditorArtifactEffects } from "./editor-artifact-effects";

describe("editor artifact effects", () => {
  it("uses the current document name for an ephemeral export URL", async () => {
    const releaseObjectUrl = vi.fn();
    const repository = {
      createObjectUrl: vi.fn(() => ({
        artifactId: createArtifactId("result"),
        url: "blob:result",
      })),
      releaseObjectUrl,
    };
    const download = { start: vi.fn() };
    const effects = createEditorArtifactEffects({
      download,
      fileName: () => "portrait.jpeg",
      repository: repository as never,
    });
    effects.exportPng({
      type: "export-png",
      artifactId: createArtifactId("result"),
      documentId: createDocumentId("document-1"),
      revision: 1,
    });
    expect(download.start).toHaveBeenCalledWith(
      "blob:result",
      "portrait-no-background.png",
    );
    await Promise.resolve();
    expect(releaseObjectUrl).toHaveBeenCalledWith("blob:result");
  });

  it("keeps current/history leases reachable across commit, undo, redo, pruning, and reset", () => {
    let next = 0;
    const repository = new ArtifactRepository({
      idSource: { next: () => createArtifactId(`artifact-${++next}`) },
      memoryBudgetBytes: 1024,
      urlAdapter: { create: () => "blob:test", revoke: vi.fn() },
    });
    const documentId = createDocumentId("document-1");
    const draftId = createManualDraftId("draft-1");
    const documentOwner = { kind: "document", documentId } as const;
    const draftOwner = { kind: "manual-draft", documentId, draftId } as const;
    const registerSnapshot = (owner: typeof documentOwner | typeof draftOwner) => ({
      matte: repository.register(
        new Uint8ClampedArray([255]),
        {
          kind: "matte",
          mediaType: "application/octet-stream",
          width: 1,
          height: 1,
          estimatedBytes: 1,
        },
        owner,
      ),
      foreground: null,
      composite: repository.register(
        new Blob(["png"], { type: "image/png" }),
        {
          kind: "composite",
          mediaType: "image/png",
          width: 1,
          height: 1,
          estimatedBytes: 3,
        },
        owner,
      ),
    });
    const before = registerSnapshot(documentOwner);
    const after = registerSnapshot(draftOwner);
    const effects = createEditorArtifactEffects({
      download: { start: vi.fn() },
      fileName: () => "portrait.png",
      repository,
    });
    const entry = {
      operationId: createEditOperationId("operation-1"),
      kind: "manual-cutout" as const,
      before,
      after,
      estimatedHistoricalBytes: 4,
    };
    effects.commitManualHistory({
      type: "commit-manual-history",
      documentId,
      draftId,
      entry,
      released: [],
    });
    expect(repository.stats()).toMatchObject({ artifacts: 4, leases: 6 });
    effects.moveDocumentHistory({
      type: "move-document-history",
      documentId,
      from: after,
      to: before,
    });
    effects.moveDocumentHistory({
      type: "move-document-history",
      documentId,
      from: before,
      to: after,
    });
    repository.releaseOwnerIfPresent({
      kind: "history",
      documentId,
      operationId: entry.operationId,
    });
    expect(repository.stats()).toMatchObject({ artifacts: 2, leases: 2 });
    effects.releaseDocument({ type: "release-document", documentId });
    repository.assertEmpty();
  });
});
