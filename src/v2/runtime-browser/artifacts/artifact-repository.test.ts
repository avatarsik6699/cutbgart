import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createRunId,
  type ArtifactLeaseOwner,
} from "@/v2/domain";

import { createNativeArtifactIdSource } from "./artifact-id-source";
import { ArtifactRepository, ArtifactRepositoryError } from "./artifact-repository";
import type { ArtifactUrlAdapter } from "./artifact-url-adapter";

const documentId = createDocumentId("document-1");
const runId = createRunId("run-1");
const documentOwner = { kind: "document", documentId } as const;
const runOwner = { kind: "run", documentId, runId } as const;
const previewOwner = { kind: "preview", documentId } as const;

function createRepository(
  options: { budget?: number; urlAdapter?: ArtifactUrlAdapter } = {},
) {
  let nextId = 0;
  return new ArtifactRepository({
    assertions: "throw",
    idSource: { next: () => createArtifactId(`artifact-${++nextId}`) },
    memoryBudgetBytes: options.budget ?? 1024,
    urlAdapter: options.urlAdapter,
  });
}

function registerBlob(
  repository: ArtifactRepository,
  owner: ArtifactLeaseOwner = runOwner,
) {
  return repository.register(
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
}

describe("ArtifactRepository", () => {
  it("creates artifact IDs through an injected browser randomness boundary", () => {
    const source = createNativeArtifactIdSource(() => "uuid-1");
    expect(source.next()).toBe(createArtifactId("uuid-1"));
  });

  it("registers opaque artifacts and disposes them after the last lease", () => {
    const repository = createRepository();
    const id = registerBlob(repository);

    expect(repository.metadata(id)).toMatchObject({ id, kind: "composite" });
    expect(repository.stats()).toEqual({
      artifacts: 1,
      leases: 1,
      objectUrls: 0,
      estimatedBytes: 3,
    });

    repository.retain(id, documentOwner);
    repository.release(id, runOwner);
    expect(repository.stats().leases).toBe(1);
    repository.release(id, documentOwner);
    expect(repository.stats()).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
      estimatedBytes: 0,
    });
    expect(() => repository.read(id)).toThrowError(ArtifactRepositoryError);
  });

  it("promotes a complete run set atomically", () => {
    const repository = createRepository();
    const first = registerBlob(repository);
    const second = registerBlob(repository);

    expect(repository.promote([first, second], runOwner, documentOwner)).toBe(true);
    expect(repository.stats().leases).toBe(2);
    expect(() => repository.release(first, runOwner)).toThrow("does not lease");

    expect(() =>
      repository.promote([first, createArtifactId("missing")], documentOwner, runOwner),
    ).toThrow("Every promoted artifact");
    expect(repository.release(first, documentOwner)).toBe(true);
    expect(repository.release(second, documentOwner)).toBe(true);
    repository.assertEmpty();
  });

  it("centralizes object URL leases and revocation", () => {
    const create = vi.fn(() => "blob:preview-1");
    const revoke = vi.fn();
    const repository = createRepository({ urlAdapter: { create, revoke } });
    const id = registerBlob(repository, documentOwner);

    const objectUrl = repository.createObjectUrl(id, previewOwner);
    expect(objectUrl?.url).toBe("blob:preview-1");
    expect(repository.stats()).toMatchObject({ leases: 2, objectUrls: 1 });

    repository.releaseObjectUrl("blob:preview-1");
    expect(revoke).toHaveBeenCalledWith("blob:preview-1");
    expect(repository.stats()).toMatchObject({ leases: 1, objectUrls: 0 });
    repository.release(id, documentOwner);
    repository.assertEmpty();
  });

  it("releases every URL and artifact lease owned by a scope", () => {
    const revoke = vi.fn();
    const repository = createRepository({
      urlAdapter: { create: () => "blob:preview-1", revoke },
    });
    const id = registerBlob(repository, documentOwner);
    repository.createObjectUrl(id, previewOwner);

    expect(repository.releaseOwnerIfPresent(previewOwner)).toBe(0);
    expect(revoke).toHaveBeenCalledOnce();
    expect(repository.releaseOwnerIfPresent(documentOwner)).toBe(1);
    repository.assertEmpty();
    expect(repository.releaseOwnerIfPresent(documentOwner)).toBe(0);
  });

  it("fails before exceeding its memory budget", () => {
    const repository = createRepository({ budget: 2 });
    expect(() => registerBlob(repository)).toThrow("Artifact budget exceeded");
    repository.assertEmpty();
  });

  it("asserts duplicate and double release in development mode", () => {
    const repository = createRepository();
    const id = registerBlob(repository);

    expect(() => repository.retain(id, runOwner)).toThrow("already leases");
    repository.release(id, runOwner);
    expect(() => repository.release(id, runOwner)).toThrowError(
      expect.objectContaining({ code: "double-release" }),
    );
  });

  it("reports leaks and disposes remaining artifacts deterministically", () => {
    const repository = createRepository();
    registerBlob(repository);

    expect(() => repository.assertEmpty()).toThrow("not empty");
    repository.dispose();
    expect(repository.stats()).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
      estimatedBytes: 0,
    });
    expect(() => registerBlob(repository)).toThrow("disposed");
  });
});
