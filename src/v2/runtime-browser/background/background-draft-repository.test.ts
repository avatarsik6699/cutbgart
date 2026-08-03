import { describe, expect, it, vi } from "vitest";

import { createArtifactId, createBackgroundDraftId, createDocumentId } from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";
import { BackgroundDraftRepository } from "./background-draft-repository";

describe("BackgroundDraftRepository", () => {
  it("replaces preview/artifact ownership and releases it deterministically", () => {
    let nextArtifact = 0;
    let nextUrl = 0;
    const revoke = vi.fn();
    const artifacts = new ArtifactRepository({
      idSource: {
        next: () => createArtifactId(`background-${++nextArtifact}`),
      },
      memoryBudgetBytes: 1024,
      urlAdapter: { create: () => `blob:background-${++nextUrl}`, revoke },
    });
    const drafts = new BackgroundDraftRepository(artifacts);
    const documentId = createDocumentId("document-1");
    const draftId = createBackgroundDraftId("background-draft-1");
    const first = drafts.replace(documentId, draftId, {
      blob: new Blob(["first"], { type: "image/png" }),
      mediaType: "image/png",
      width: 2,
      height: 1,
    });
    expect(drafts.get(draftId)).toEqual(first);
    expect(artifacts.stats()).toMatchObject({ artifacts: 1, leases: 2, objectUrls: 1 });

    const second = drafts.replace(documentId, draftId, {
      blob: new Blob(["second"], { type: "image/png" }),
      mediaType: "image/png",
      width: 1,
      height: 1,
    });
    expect(second.artifactId).not.toBe(first.artifactId);
    expect(revoke).toHaveBeenCalledWith(first.previewUrl);
    expect(artifacts.stats()).toMatchObject({ artifacts: 1, leases: 2, objectUrls: 1 });

    drafts.release(documentId, draftId);
    expect(drafts.get(draftId)).toBeNull();
    expect(artifacts.stats()).toMatchObject({ artifacts: 0, leases: 0, objectUrls: 0 });
    artifacts.assertEmpty();
  });
});
