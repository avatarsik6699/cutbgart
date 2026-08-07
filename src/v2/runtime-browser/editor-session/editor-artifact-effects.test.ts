import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
  createEditOperationId,
  createManualDraftId,
  commitDocumentHistory,
  type DocumentHistoryTypes,
  type DocumentSnapshot,
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
    expect(download.start).toHaveBeenCalledWith("blob:result", "cutbg-result.png");
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
      background: { type: "transparent" } as const,
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

  it("retains an artifact-backed committed background across history movement", () => {
    let next = 0;
    const repository = new ArtifactRepository({
      idSource: { next: () => createArtifactId(`background-artifact-${++next}`) },
      memoryBudgetBytes: 1024,
      urlAdapter: { create: () => "blob:test", revoke: vi.fn() },
    });
    const documentId = createDocumentId("document-background");
    const draftId = createBackgroundDraftId("background-draft-1");
    const documentOwner = { kind: "document", documentId } as const;
    const draftOwner = { kind: "background-draft", documentId, draftId } as const;
    const matte = repository.register(
      new Uint8ClampedArray([255]),
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: 1,
        height: 1,
        estimatedBytes: 1,
      },
      documentOwner,
    );
    const beforeComposite = repository.register(
      new Blob(["before"], { type: "image/png" }),
      {
        kind: "composite",
        mediaType: "image/png",
        width: 1,
        height: 1,
        estimatedBytes: 6,
      },
      documentOwner,
    );
    repository.retain(matte, draftOwner);
    const background = repository.register(
      new Blob(["background"], { type: "image/png" }),
      {
        kind: "background-image",
        mediaType: "image/png",
        width: 1,
        height: 1,
        estimatedBytes: 10,
      },
      draftOwner,
    );
    const afterComposite = repository.register(
      new Blob(["after"], { type: "image/png" }),
      {
        kind: "composite",
        mediaType: "image/png",
        width: 1,
        height: 1,
        estimatedBytes: 5,
      },
      draftOwner,
    );
    const before = {
      matte,
      foreground: null,
      composite: beforeComposite,
      background: { type: "transparent" } as const,
    };
    const after = {
      matte,
      foreground: null,
      composite: afterComposite,
      background: { type: "image", artifactId: background } as const,
    };
    const operationId = createEditOperationId("background-operation-1");
    const effects = createEditorArtifactEffects({
      download: { start: vi.fn() },
      fileName: () => "portrait.png",
      repository,
    });
    effects.commitBackgroundHistory?.({
      type: "commit-background-history",
      documentId,
      draftId,
      entry: {
        operationId,
        kind: "background",
        before,
        after,
        estimatedHistoricalBytes: 16,
      },
      released: [],
    });
    expect(repository.metadata(background)).not.toBeNull();
    effects.moveDocumentHistory({
      type: "move-document-history",
      documentId,
      from: after,
      to: before,
    });
    expect(repository.metadata(background)).not.toBeNull();
    repository.releaseOwnerIfPresent({ kind: "history", documentId, operationId });
    expect(repository.stats()).toMatchObject({ artifacts: 2, leases: 2 });
    effects.releaseDocument({ type: "release-document", documentId });
    expect(repository.stats()).toMatchObject({ artifacts: 0, leases: 0 });
  });

  it("releases every reachable lease after seeded finishing-history churn", () => {
    let nextArtifact = 0;
    let seed = 0x36f1a;
    const random = (): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const repository = new ArtifactRepository({
      idSource: { next: () => createArtifactId(`churn-artifact-${++nextArtifact}`) },
      memoryBudgetBytes: 4096,
    });
    const documentId = createDocumentId("document-churn");
    const documentOwner = { kind: "document", documentId } as const;
    const matte = repository.register(
      new Uint8ClampedArray([255]),
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: 1,
        height: 1,
        estimatedBytes: 1,
      },
      documentOwner,
    );
    let current: DocumentSnapshot = {
      matte,
      foreground: null,
      composite: repository.register(
        new Blob(["initial"], { type: "image/png" }),
        {
          kind: "composite",
          mediaType: "image/png",
          width: 1,
          height: 1,
          estimatedBytes: 7,
        },
        documentOwner,
      ),
      background: { type: "transparent" },
    };
    let history: DocumentHistoryTypes.State = {
      past: [],
      future: [],
      retainedHistoricalBytes: 0,
    };
    const effects = createEditorArtifactEffects({
      download: { start: vi.fn() },
      fileName: () => "churn.png",
      repository,
    });

    for (let index = 0; index < 64; index += 1) {
      const draftId = createBackgroundDraftId(`background-churn-${index}`);
      const draftOwner = { kind: "background-draft", documentId, draftId } as const;
      const imageBackground = random() > 0.5;
      const background = imageBackground
        ? ({
            type: "image",
            artifactId: repository.register(
              new Blob([`background-${index}`], { type: "image/png" }),
              {
                kind: "background-image",
                mediaType: "image/png",
                width: 1,
                height: 1,
                estimatedBytes: 10,
              },
              draftOwner,
            ),
          } as const)
        : ({ type: "color", value: "#112233" } as const);
      const after: DocumentSnapshot = {
        matte,
        foreground: null,
        composite: repository.register(
          new Blob([`composite-${index}`], { type: "image/png" }),
          {
            kind: "composite",
            mediaType: "image/png",
            width: 1,
            height: 1,
            estimatedBytes: 12,
          },
          draftOwner,
        ),
        background,
      };
      const entry = {
        operationId: createEditOperationId(`background-operation-${index}`),
        kind: "background" as const,
        before: current,
        after,
        estimatedHistoricalBytes: imageBackground ? 22 : 12,
      };
      const change = commitDocumentHistory(history, entry);
      effects.commitBackgroundHistory?.({
        type: "commit-background-history",
        documentId,
        draftId,
        entry,
        released: change.released,
      });
      history = change.history;
      current = after;
      expect(repository.stats().leases).toBeGreaterThan(0);
    }

    expect(history.past).toHaveLength(20);
    for (const entry of history.past) {
      repository.releaseOwnerIfPresent({
        kind: "history",
        documentId,
        operationId: entry.operationId,
      });
    }
    effects.releaseDocument({ type: "release-document", documentId });
    repository.assertEmpty();
  });
});
