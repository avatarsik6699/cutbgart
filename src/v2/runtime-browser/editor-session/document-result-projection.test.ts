import { describe, expect, it, vi } from "vitest";

import type { DocumentActorRef } from "@/v2/application";
import { createArtifactId, createDocumentId } from "@/v2/domain";
import { buildDocumentState } from "@/v2/testing";

import { DocumentResultProjection } from "./document-result-projection";

describe("DocumentResultProjection", () => {
  it("publishes one URL per committed artifact and owns its subscription", () => {
    const unsubscribe = vi.fn();
    const composite = createArtifactId("composite-1");
    const document = buildDocumentState({
      status: "result",
      committed: { matte: createArtifactId("matte-1"), foreground: null, composite },
    });
    const actor = {
      subscribe(listener: (snapshot: unknown) => void) {
        listener({ context: { document } });
        listener({ context: { document } });
        return { unsubscribe };
      },
    } as unknown as DocumentActorRef;
    const repository = {
      createObjectUrl: vi.fn(() => ({ artifactId: composite, url: "blob:result" })),
      releaseObjectUrl: vi.fn(() => true),
    };
    const publish = vi.fn();
    const projection = new DocumentResultProjection(repository as never);

    projection.watch(actor, createDocumentId("document-1"), publish);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith("blob:result");
    projection.stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(repository.releaseObjectUrl).toHaveBeenCalledWith("blob:result");
  });
});
