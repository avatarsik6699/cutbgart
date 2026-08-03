import type { DocumentArtifactEffects } from "@/v2/application";

import type { ArtifactRepository } from "../artifacts";
import type { DownloadAdapter } from "../platform";

function exportName(fileName: string | null): string {
  const base = fileName?.replace(/\.[^.]+$/, "").trim() || "cutbg-result";
  return `${base}-no-background.png`;
}

export function createEditorArtifactEffects(options: {
  download: DownloadAdapter;
  fileName(): string | null;
  repository: ArtifactRepository;
}): DocumentArtifactEffects {
  return {
    exportPng(effect) {
      const objectUrl = options.repository.createObjectUrl(effect.artifactId, {
        kind: "export",
        documentId: effect.documentId,
      });
      if (objectUrl === null) return;
      options.download.start(objectUrl.url, exportName(options.fileName()));
      queueMicrotask(() => options.repository.releaseObjectUrl(objectUrl.url));
    },
    promoteRun(effect) {
      return options.repository.promote(
        [effect.snapshot.matte, effect.snapshot.composite],
        { kind: "run", documentId: effect.documentId, runId: effect.runId },
        { kind: "document", documentId: effect.documentId },
      );
    },
    releaseDocument(effect) {
      options.repository.releaseOwnerIfPresent({
        kind: "preview",
        documentId: effect.documentId,
      });
      options.repository.releaseOwnerIfPresent({
        kind: "export",
        documentId: effect.documentId,
      });
      options.repository.releaseOwnerIfPresent({
        kind: "document",
        documentId: effect.documentId,
      });
    },
    releaseRun(effect) {
      options.repository.releaseOwnerIfPresent({
        kind: "run",
        documentId: effect.documentId,
        runId: effect.runId,
      });
    },
  };
}
