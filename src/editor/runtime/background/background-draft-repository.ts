import type { ArtifactId, BackgroundDraftId, DocumentId } from "@/editor/domain";

import type { ArtifactRepository } from "../artifacts";
import type { PreparedBackgroundImage } from "./background-image-client";

export type PreparedBackgroundRecord = {
  artifactId: ArtifactId;
  previewUrl: string;
};

export class BackgroundDraftRepository {
  readonly #artifacts: ArtifactRepository;
  readonly #records = new Map<BackgroundDraftId, PreparedBackgroundRecord>();

  constructor(artifacts: ArtifactRepository) {
    this.#artifacts = artifacts;
  }

  replace(
    documentId: DocumentId,
    draftId: BackgroundDraftId,
    prepared: PreparedBackgroundImage,
  ): PreparedBackgroundRecord {
    this.release(documentId, draftId);
    const owner = { kind: "background-draft", documentId, draftId } as const;
    const artifactId = this.#artifacts.register(
      prepared.blob,
      {
        kind: "background-image",
        mediaType: prepared.mediaType,
        width: prepared.width,
        height: prepared.height,
        estimatedBytes: prepared.blob.size,
      },
      owner,
    );
    const objectUrl = this.#artifacts.createObjectUrl(artifactId, {
      kind: "background-preview",
      documentId,
      draftId,
    });
    if (objectUrl === null) {
      this.#artifacts.releaseOwnerIfPresent(owner);
      throw new Error("Could not create a background preview URL");
    }
    const record = { artifactId, previewUrl: objectUrl.url };
    this.#records.set(draftId, record);
    return record;
  }

  get(draftId: BackgroundDraftId): PreparedBackgroundRecord | null {
    return this.#records.get(draftId) ?? null;
  }

  forget(draftId: BackgroundDraftId): void {
    const record = this.#records.get(draftId);
    if (record === undefined) return;
    this.#artifacts.releaseObjectUrl(record.previewUrl);
    this.#records.delete(draftId);
  }

  release(documentId: DocumentId, draftId: BackgroundDraftId): void {
    this.forget(draftId);
    this.#artifacts.releaseOwnerIfPresent({
      kind: "background-draft",
      documentId,
      draftId,
    });
  }
}
