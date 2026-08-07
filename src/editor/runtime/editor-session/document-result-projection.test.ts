import { describe, expect, it, vi } from "vitest";

import type { DocumentMachineTypes } from "@/editor/application";
import { createArtifactId, createDocumentId } from "@/editor/domain";
import { buildDocumentState } from "@/editor/testing";

import { DocumentResultProjection } from "./document-result-projection";

describe("DocumentResultProjection", () => {
  it("publishes one URL per committed artifact and owns its subscription", () => {
    const unsubscribe = vi.fn();
    const composite = createArtifactId("composite-1");
    const document = buildDocumentState({
      status: "result",
      committed: {
        matte: createArtifactId("matte-1"),
        foreground: null,
        composite,
        background: { type: "transparent" },
      },
    });
    const actor = {
      subscribe(listener: (snapshot: unknown) => void) {
        listener({ context: { document } });
        listener({ context: { document } });
        return { unsubscribe };
      },
    } as unknown as DocumentMachineTypes.ActorRef;
    const repository = {
      createObjectUrl: vi.fn(() => ({ artifactId: composite, url: "blob:result" })),
      releaseObjectUrl: vi.fn(() => true),
    };
    const publish = vi.fn();
    const projection = new DocumentResultProjection(repository as never);

    projection.watch(actor, createDocumentId("document-1"), publish);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith("blob:result", "blob:result");
    projection.stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(repository.releaseObjectUrl).toHaveBeenCalledWith("blob:result");
  });

  it("owns distinct committed composite and foreground URLs exactly once", () => {
    const composite = createArtifactId("composite-1");
    const foreground = createArtifactId("foreground-1");
    const document = buildDocumentState({
      status: "result",
      committed: {
        matte: createArtifactId("matte-1"),
        foreground,
        composite,
        background: { type: "color", value: "#112233" },
      },
    });
    const actor = {
      subscribe(listener: (snapshot: unknown) => void) {
        listener({ context: { document } });
        return { unsubscribe: vi.fn() };
      },
    } as unknown as DocumentMachineTypes.ActorRef;
    const repository = {
      createObjectUrl: vi.fn((artifactId: string) => ({
        artifactId,
        url: artifactId === composite ? "blob:result" : "blob:foreground",
      })),
      releaseObjectUrl: vi.fn(() => true),
    };
    const publish = vi.fn();
    const projection = new DocumentResultProjection(repository as never);

    projection.watch(actor, createDocumentId("document-1"), publish);
    expect(publish).toHaveBeenCalledWith("blob:result", "blob:foreground");
    expect(repository.createObjectUrl).toHaveBeenCalledTimes(2);
    projection.stop();
    expect(repository.releaseObjectUrl.mock.calls).toHaveLength(2);
    expect(repository.releaseObjectUrl.mock.calls).toEqual(
      expect.arrayContaining([["blob:result"], ["blob:foreground"]]),
    );
  });
});
