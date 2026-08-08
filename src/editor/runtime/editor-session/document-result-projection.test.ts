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
        automaticModelMode: "isnet-q8",
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
    expect(publish).toHaveBeenCalledWith("blob:result", "blob:result", "blob:result");
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
        automaticModelMode: "isnet-q8",
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
    expect(publish).toHaveBeenCalledWith("blob:result", "blob:foreground", "blob:result");
    expect(repository.createObjectUrl).toHaveBeenCalledTimes(2);
    projection.stop();
    expect(repository.releaseObjectUrl.mock.calls).toHaveLength(2);
    expect(repository.releaseObjectUrl.mock.calls).toEqual(
      expect.arrayContaining([["blob:result"], ["blob:foreground"]]),
    );
  });

  it("pins the original URL to the first commit and never re-derives or releases it early", () => {
    const initialComposite = createArtifactId("composite-1");
    const laterComposite = createArtifactId("composite-2");
    let document = buildDocumentState({
      status: "result",
      committed: {
        automaticModelMode: "isnet-q8",
        matte: createArtifactId("matte-1"),
        foreground: null,
        composite: initialComposite,
        background: { type: "transparent" },
      },
    });
    let listener: (snapshot: unknown) => void = () => {};
    const actor = {
      subscribe(next: (snapshot: unknown) => void) {
        listener = next;
        listener({ context: { document } });
        return { unsubscribe: vi.fn() };
      },
    } as unknown as DocumentMachineTypes.ActorRef;
    let urlCounter = 0;
    const repository = {
      createObjectUrl: vi.fn(() => {
        urlCounter += 1;
        return { artifactId: "irrelevant", url: `blob:generated-${String(urlCounter)}` };
      }),
      releaseObjectUrl: vi.fn(() => true),
    };
    const publish = vi.fn();
    const projection = new DocumentResultProjection(repository as never);

    projection.watch(actor, createDocumentId("document-1"), publish);
    const [, , firstOriginalUrl] = publish.mock.calls[0] as [string, string, string];
    expect(firstOriginalUrl).toBe("blob:generated-1");

    document = buildDocumentState({
      status: "result",
      committed: {
        automaticModelMode: "isnet-q8",
        matte: createArtifactId("matte-1"),
        foreground: null,
        composite: laterComposite,
        background: { type: "transparent" },
      },
    });
    listener({ context: { document } });
    const lastCall = publish.mock.calls.at(-1) as [string, string, string];
    expect(lastCall[2]).toBe(firstOriginalUrl);
    expect(repository.releaseObjectUrl).not.toHaveBeenCalledWith(firstOriginalUrl);

    projection.stop();
    expect(repository.releaseObjectUrl).toHaveBeenCalledWith(firstOriginalUrl);
  });
});
