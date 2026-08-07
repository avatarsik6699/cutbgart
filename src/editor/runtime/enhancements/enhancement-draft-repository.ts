import type {
  ArtifactId,
  DocumentId,
  DocumentSnapshot,
  EnhancementDraftId,
  Revision,
} from "@/editor/domain";

import type { ArtifactRepository } from "../artifacts";

export type EnhancementDraftBaseline = Readonly<{
  documentId: DocumentId;
  draftId: EnhancementDraftId;
  baselineRevision: Revision;
  source: ArtifactId;
  snapshot: DocumentSnapshot;
  width: number;
  height: number;
}>;

export type EnhancementDraftPixels = Readonly<{
  source: Blob;
  matte: Uint8ClampedArray;
  foreground: Blob | null;
}>;

type EnhancementDraftRecord = {
  baseline: EnhancementDraftBaseline;
  sourceValue: Blob;
  matteValue: Uint8ClampedArray;
  foregroundValue: Blob | null;
};

function snapshotIds(snapshot: DocumentSnapshot): readonly ArtifactId[] {
  return [
    ...new Set([
      snapshot.matte,
      snapshot.foreground,
      snapshot.composite,
      snapshot.background.type === "image" ? snapshot.background.artifactId : null,
    ]),
  ].filter((id): id is ArtifactId => id !== null);
}

export class EnhancementDraftRepository {
  readonly #artifacts: ArtifactRepository;
  readonly #records = new Map<EnhancementDraftId, EnhancementDraftRecord>();

  constructor(artifacts: ArtifactRepository) {
    this.#artifacts = artifacts;
  }

  capture(input: {
    documentId: DocumentId;
    draftId: EnhancementDraftId;
    baselineRevision: Revision;
    source: ArtifactId;
    snapshot: DocumentSnapshot;
  }): EnhancementDraftBaseline {
    if (this.#records.has(input.draftId))
      throw new Error("Enhancement draft baseline already exists");
    const sourceValue = this.#artifacts.read(input.source);
    const sourceMetadata = this.#artifacts.metadata(input.source);
    const matteValue = this.#artifacts.read(input.snapshot.matte);
    const matteMetadata = this.#artifacts.metadata(input.snapshot.matte);
    const foregroundValue =
      input.snapshot.foreground === null
        ? null
        : this.#artifacts.read(input.snapshot.foreground);
    const foregroundMetadata =
      input.snapshot.foreground === null
        ? null
        : this.#artifacts.metadata(input.snapshot.foreground);
    if (
      !(sourceValue instanceof Blob) ||
      sourceMetadata === null ||
      !(matteValue instanceof Uint8ClampedArray) ||
      matteMetadata === null ||
      matteValue.length !== matteMetadata.width * matteMetadata.height ||
      sourceMetadata.width !== matteMetadata.width ||
      sourceMetadata.height !== matteMetadata.height ||
      (input.snapshot.foreground !== null &&
        (!(foregroundValue instanceof Blob) ||
          foregroundMetadata === null ||
          foregroundMetadata.width !== matteMetadata.width ||
          foregroundMetadata.height !== matteMetadata.height))
    ) {
      throw new Error("Enhancement baseline artifacts are unavailable or inconsistent");
    }
    const owner = {
      kind: "enhancement-draft",
      documentId: input.documentId,
      draftId: input.draftId,
    } as const;
    const ids = [...new Set([input.source, ...snapshotIds(input.snapshot)])];
    const retained: ArtifactId[] = [];
    try {
      for (const id of ids) {
        if (!this.#artifacts.retain(id, owner))
          throw new Error("Could not retain enhancement baseline artifact");
        retained.push(id);
      }
    } catch (error) {
      for (const id of retained) this.#artifacts.release(id, owner);
      throw error;
    }
    const baseline = Object.freeze({
      documentId: input.documentId,
      draftId: input.draftId,
      baselineRevision: input.baselineRevision,
      source: input.source,
      snapshot: input.snapshot,
      width: matteMetadata.width,
      height: matteMetadata.height,
    });
    this.#records.set(input.draftId, {
      baseline,
      sourceValue,
      matteValue: matteValue.slice(),
      foregroundValue: foregroundValue instanceof Blob ? foregroundValue : null,
    });
    return baseline;
  }

  get(draftId: EnhancementDraftId): EnhancementDraftBaseline | null {
    return this.#records.get(draftId)?.baseline ?? null;
  }

  pixels(draftId: EnhancementDraftId): EnhancementDraftPixels | null {
    const record = this.#records.get(draftId);
    return record === undefined
      ? null
      : {
          source: record.sourceValue,
          matte: record.matteValue.slice(),
          foreground: record.foregroundValue,
        };
  }

  forget(draftId: EnhancementDraftId): void {
    this.#records.delete(draftId);
  }

  release(documentId: DocumentId, draftId: EnhancementDraftId): void {
    this.#records.delete(draftId);
    this.#artifacts.releaseOwnerIfPresent({
      kind: "enhancement-draft",
      documentId,
      draftId,
    });
  }
}
