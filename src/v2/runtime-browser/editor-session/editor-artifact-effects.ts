import type { DocumentArtifactEffects } from "@/v2/application";
import type {
  ArtifactId,
  ArtifactLeaseOwner,
  DocumentEffect,
  DocumentSnapshot,
} from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";
import type { DownloadAdapter } from "../platform";

function exportName(fileName: string | null): string {
  const base = fileName?.replace(/\.[^.]+$/, "").trim() || "cutbg-result";
  return `${base}-no-background.png`;
}

function snapshotIds(snapshot: DocumentSnapshot): readonly ArtifactId[] {
  return [
    ...new Set(
      [snapshot.matte, snapshot.foreground, snapshot.composite].filter(
        (id): id is ArtifactId => id !== null,
      ),
    ),
  ];
}

type DraftHistoryEffect = Extract<
  DocumentEffect,
  { type: "commit-manual-history" | "commit-magic-history" }
>;
type DraftOwner = Extract<ArtifactLeaseOwner, { kind: "manual-draft" | "magic-draft" }>;

function commitDraftHistory(
  repository: ArtifactRepository,
  effect: DraftHistoryEffect,
  draftOwner: DraftOwner,
): void {
  const historyOwner = {
    kind: "history",
    documentId: effect.documentId,
    operationId: effect.entry.operationId,
  } as const;
  for (const id of new Set([
    ...snapshotIds(effect.entry.before),
    ...snapshotIds(effect.entry.after),
  ]))
    repository.retain(id, historyOwner);
  repository.promote(snapshotIds(effect.entry.after), draftOwner, {
    kind: "document",
    documentId: effect.documentId,
  });
  repository.releaseOwnerIfPresent(draftOwner);
  const afterIds = new Set(snapshotIds(effect.entry.after));
  for (const id of snapshotIds(effect.entry.before))
    if (!afterIds.has(id))
      repository.release(id, {
        kind: "document",
        documentId: effect.documentId,
      });
  for (const released of effect.released)
    repository.releaseOwnerIfPresent({
      kind: "history",
      documentId: effect.documentId,
      operationId: released.operationId,
    });
}

export function createEditorArtifactEffects(options: {
  download: DownloadAdapter;
  fileName(): string | null;
  repository: ArtifactRepository;
}): DocumentArtifactEffects {
  return {
    estimateHistoricalBytes(snapshot) {
      return snapshotIds(snapshot).reduce(
        (total, id) => total + (options.repository.metadata(id)?.estimatedBytes ?? 0),
        0,
      );
    },
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
      const promoted = options.repository.promote(
        [effect.snapshot.matte, effect.snapshot.composite],
        { kind: "run", documentId: effect.documentId, runId: effect.runId },
        { kind: "document", documentId: effect.documentId },
      );
      if (promoted) {
        for (const id of snapshotIds(effect.snapshot)) {
          options.repository.retain(id, {
            kind: "baseline",
            documentId: effect.documentId,
          });
        }
      }
      return promoted;
    },
    releaseDocument(effect) {
      options.repository.releaseDocumentScopes(effect.documentId);
    },
    releaseRun(effect) {
      options.repository.releaseOwnerIfPresent({
        kind: "run",
        documentId: effect.documentId,
        runId: effect.runId,
      });
    },
    releaseManualDraft(effect) {
      options.repository.releaseOwnerIfPresent({
        kind: "manual-draft",
        documentId: effect.documentId,
        draftId: effect.draftId,
      });
    },
    releaseMagicDraft(effect) {
      options.repository.releaseOwnerIfPresent({
        kind: "magic-draft",
        documentId: effect.documentId,
        draftId: effect.draftId,
      });
    },
    commitManualHistory(effect) {
      commitDraftHistory(options.repository, effect, {
        kind: "manual-draft",
        documentId: effect.documentId,
        draftId: effect.draftId,
      });
    },
    commitMagicHistory(effect) {
      commitDraftHistory(options.repository, effect, {
        kind: "magic-draft",
        documentId: effect.documentId,
        draftId: effect.draftId,
      });
    },
    moveDocumentHistory(effect) {
      const fromIds = new Set(snapshotIds(effect.from));
      const toIds = new Set(snapshotIds(effect.to));
      for (const id of toIds)
        if (!fromIds.has(id))
          options.repository.retain(id, {
            kind: "document",
            documentId: effect.documentId,
          });
      for (const id of fromIds)
        if (!toIds.has(id))
          options.repository.release(id, {
            kind: "document",
            documentId: effect.documentId,
          });
    },
  };
}
