import type { DocumentActorRef } from "@/v2/application";
import type { ArtifactId, DocumentId } from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";

export class DocumentResultProjection {
  readonly #repository: ArtifactRepository;
  #foregroundArtifactId: ArtifactId | null = null;
  #foregroundUrl: string | null = null;
  #resultArtifactId: ArtifactId | null = null;
  #resultUrl: string | null = null;
  #subscription: { unsubscribe(): void } | null = null;

  constructor(repository: ArtifactRepository) {
    this.#repository = repository;
  }

  watch(
    actor: DocumentActorRef,
    documentId: DocumentId,
    publishResultUrls: (resultUrl: string | null, foregroundUrl: string | null) => void,
  ): void {
    this.stop();
    this.#subscription = actor.subscribe((actorSnapshot) => {
      const document = actorSnapshot.context.document;
      const composite = document.committed?.composite ?? null;
      const foreground =
        document.committed?.foreground ??
        (document.committed?.background.type === "transparent" ? composite : null);
      if (
        document.status !== "result" ||
        composite === null ||
        (composite === this.#resultArtifactId &&
          foreground === this.#foregroundArtifactId)
      ) {
        return;
      }
      this.#releaseUrls();
      const objectUrl = this.#repository.createObjectUrl(composite, {
        kind: "preview",
        documentId,
      });
      this.#resultUrl = objectUrl?.url ?? null;
      this.#resultArtifactId = composite;
      this.#foregroundArtifactId = foreground;
      if (foreground === composite) {
        this.#foregroundUrl = this.#resultUrl;
      } else if (foreground !== null) {
        this.#foregroundUrl =
          this.#repository.createObjectUrl(foreground, {
            kind: "preview",
            documentId,
          })?.url ?? null;
      }
      publishResultUrls(this.#resultUrl, this.#foregroundUrl);
    });
  }

  stop(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#foregroundArtifactId = null;
    this.#resultArtifactId = null;
    this.#releaseUrls();
  }

  #releaseUrls(): void {
    if (this.#foregroundUrl !== null && this.#foregroundUrl !== this.#resultUrl) {
      this.#repository.releaseObjectUrl(this.#foregroundUrl);
    }
    if (this.#resultUrl !== null) {
      this.#repository.releaseObjectUrl(this.#resultUrl);
    }
    this.#foregroundUrl = null;
    this.#resultUrl = null;
  }
}
