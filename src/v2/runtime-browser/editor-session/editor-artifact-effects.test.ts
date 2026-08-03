import { describe, expect, it, vi } from "vitest";

import { createArtifactId, createDocumentId } from "@/v2/domain";

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
});
