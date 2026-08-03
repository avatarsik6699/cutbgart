import type { DocumentActorRef } from "@/v2/application";
import type { ArtifactId, DocumentId } from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";

export class DocumentResultProjection {
  readonly #repository: ArtifactRepository;
  #resultArtifactId: ArtifactId | null = null;
  #subscription: { unsubscribe(): void } | null = null;

  constructor(repository: ArtifactRepository) {
    this.#repository = repository;
  }

  watch(
    actor: DocumentActorRef,
    documentId: DocumentId,
    publishResultUrl: (url: string | null) => void,
  ): void {
    this.stop();
    this.#subscription = actor.subscribe((actorSnapshot) => {
      const document = actorSnapshot.context.document;
      const composite = document.committed?.composite ?? null;
      if (
        document.status !== "result" ||
        composite === null ||
        composite === this.#resultArtifactId
      ) {
        return;
      }
      this.#resultArtifactId = composite;
      const objectUrl = this.#repository.createObjectUrl(composite, {
        kind: "preview",
        documentId,
      });
      publishResultUrl(objectUrl?.url ?? null);
    });
  }

  stop(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#resultArtifactId = null;
  }
}
