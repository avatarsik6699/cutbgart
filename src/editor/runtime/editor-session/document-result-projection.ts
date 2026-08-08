import type { DocumentMachineTypes } from "@/editor/application";
import type { ArtifactId, DocumentId } from "@/editor/domain";

import type { ArtifactRepository } from "../artifacts";

type DocumentActorSnapshot = ReturnType<DocumentMachineTypes.ActorRef["getSnapshot"]>;

function committedForeground(
  document: DocumentActorSnapshot["context"]["document"],
): ArtifactId | null {
  const composite = document.committed?.composite ?? null;
  return (
    document.committed?.foreground ??
    (document.committed?.background.type === "transparent" ? composite : null)
  );
}

export class DocumentResultProjection {
  readonly #repository: ArtifactRepository;
  #foregroundArtifactId: ArtifactId | null = null;
  #foregroundUrl: string | null = null;
  #originalArtifactId: ArtifactId | null = null;
  #originalUrl: string | null = null;
  #resultArtifactId: ArtifactId | null = null;
  #resultUrl: string | null = null;
  #subscription: { unsubscribe(): void } | null = null;

  constructor(repository: ArtifactRepository) {
    this.#repository = repository;
  }

  watch(
    actor: DocumentMachineTypes.ActorRef,
    documentId: DocumentId,
    publishResultUrls: (
      resultUrl: string | null,
      foregroundUrl: string | null,
      originalUrl: string | null,
    ) => void,
  ): void {
    this.stop();
    this.#subscription = actor.subscribe((actorSnapshot) =>
      this.#projectSnapshot(actorSnapshot, documentId, publishResultUrls),
    );
  }

  stop(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#foregroundArtifactId = null;
    this.#resultArtifactId = null;
    this.#originalArtifactId = null;
    this.#releaseUrls();
    if (this.#originalUrl !== null) {
      this.#repository.releaseObjectUrl(this.#originalUrl);
      this.#originalUrl = null;
    }
  }

  /** The pinned original's `{kind:"preview"}` lease stays held for the whole
   * document lifetime, so any later composite/foreground that happens to
   * reference that same artifact again (e.g. an unedited cutout referenced
   * as `foreground` once a background fill is applied, or an Undo back to
   * the first commit) must reuse its URL instead of leasing it a second
   * time, which the repository rejects as a duplicate lease. */
  #resolveUrl(id: ArtifactId, documentId: DocumentId): string | null {
    if (id === this.#originalArtifactId) return this.#originalUrl;
    return (
      this.#repository.createObjectUrl(id, { kind: "preview", documentId })?.url ?? null
    );
  }

  #projectSnapshot(
    actorSnapshot: DocumentActorSnapshot,
    documentId: DocumentId,
    publishResultUrls: (
      resultUrl: string | null,
      foregroundUrl: string | null,
      originalUrl: string | null,
    ) => void,
  ): void {
    const document = actorSnapshot.context.document;
    const composite = document.committed?.composite ?? null;
    const foreground = committedForeground(document);
    const unchanged =
      composite === this.#resultArtifactId && foreground === this.#foregroundArtifactId;
    if (document.status !== "result" || composite === null || unchanged) return;

    this.#replaceUrls(composite, foreground, documentId);
    // Pinned once, on the very first committed result; never re-derived on
    // later edits or reprocessing, so "before" panes can keep comparing it.
    if (this.#originalArtifactId === null) {
      this.#originalArtifactId = composite;
      this.#originalUrl = this.#resultUrl;
    }
    publishResultUrls(this.#resultUrl, this.#foregroundUrl, this.#originalUrl);
  }

  #replaceUrls(
    composite: ArtifactId,
    foreground: ArtifactId | null,
    documentId: DocumentId,
  ): void {
    this.#releaseUrls();
    this.#resultUrl = this.#resolveUrl(composite, documentId);
    this.#resultArtifactId = composite;
    this.#foregroundArtifactId = foreground;
    if (foreground === null) this.#foregroundUrl = null;
    else if (foreground === composite) this.#foregroundUrl = this.#resultUrl;
    else this.#foregroundUrl = this.#resolveUrl(foreground, documentId);
  }

  #releaseUrls(): void {
    if (
      this.#foregroundUrl !== null &&
      this.#foregroundUrl !== this.#resultUrl &&
      this.#foregroundUrl !== this.#originalUrl
    ) {
      this.#repository.releaseObjectUrl(this.#foregroundUrl);
    }
    if (this.#resultUrl !== null && this.#resultUrl !== this.#originalUrl) {
      this.#repository.releaseObjectUrl(this.#resultUrl);
    }
    this.#foregroundUrl = null;
    this.#resultUrl = null;
  }
}
