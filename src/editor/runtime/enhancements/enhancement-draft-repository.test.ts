import { describe, expect, it } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createEnhancementDraftId,
} from "@/editor/domain";

import { ArtifactRepository } from "../artifacts";
import { EnhancementDraftRepository } from "./enhancement-draft-repository";

function harness() {
  let next = 0;
  const documentId = createDocumentId("document-1");
  const repository = new ArtifactRepository({
    idSource: { next: () => createArtifactId(`enhancement-${++next}`) },
    memoryBudgetBytes: 1024,
  });
  const owner = { kind: "document", documentId } as const;
  const source = repository.register(
    new Blob(["source"], { type: "image/png" }),
    {
      kind: "source",
      mediaType: "image/png",
      width: 2,
      height: 1,
      estimatedBytes: 6,
    },
    owner,
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
    owner,
  );
  const composite = repository.register(
    new Blob(["composite"], { type: "image/png" }),
    {
      kind: "composite",
      mediaType: "image/png",
      width: 2,
      height: 1,
      estimatedBytes: 9,
    },
    owner,
  );
  const background = repository.register(
    new Blob(["background"], { type: "image/webp" }),
    {
      kind: "background-image",
      mediaType: "image/webp",
      width: 2,
      height: 1,
      estimatedBytes: 10,
    },
    owner,
  );
  return {
    documentId,
    repository,
    source,
    snapshot: {
      automaticModelMode: "isnet-q8" as const,
      matte,
      foreground: null,
      composite,
      background: { type: "image", artifactId: background } as const,
    },
  };
}

describe("EnhancementDraftRepository", () => {
  it("captures one leased baseline and returns fresh matte pixels", () => {
    const subject = harness();
    const drafts = new EnhancementDraftRepository(subject.repository);
    const draftId = createEnhancementDraftId("enhancement-draft-1");
    expect(
      drafts.capture({
        documentId: subject.documentId,
        draftId,
        baselineRevision: 4,
        source: subject.source,
        snapshot: subject.snapshot,
      }),
    ).toMatchObject({ baselineRevision: 4, width: 2, height: 1 });
    expect(subject.repository.stats()).toMatchObject({ artifacts: 4, leases: 8 });
    const first = drafts.pixels(draftId);
    const second = drafts.pixels(draftId);
    expect(first?.matte).toEqual(new Uint8ClampedArray([10, 20]));
    expect(first?.matte).not.toBe(second?.matte);
    if (first !== null) first.matte[0] = 255;
    expect(drafts.pixels(draftId)?.matte[0]).toBe(10);

    drafts.release(subject.documentId, draftId);
    expect(subject.repository.stats()).toMatchObject({ artifacts: 4, leases: 4 });
    subject.repository.releaseDocumentScopes(subject.documentId);
    subject.repository.assertEmpty();
  });

  it("rolls back partial leases when any baseline artifact is stale", () => {
    const subject = harness();
    const drafts = new EnhancementDraftRepository(subject.repository);
    expect(() =>
      drafts.capture({
        documentId: subject.documentId,
        draftId: createEnhancementDraftId("enhancement-draft-1"),
        baselineRevision: 4,
        source: subject.source,
        snapshot: {
          ...subject.snapshot,
          composite: createArtifactId("missing-composite"),
        },
      }),
    ).toThrow();
    expect(subject.repository.stats()).toMatchObject({ artifacts: 4, leases: 4 });
  });
});
