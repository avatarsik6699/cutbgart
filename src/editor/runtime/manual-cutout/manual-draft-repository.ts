import type { DocumentId, ManualDraftId } from "@/editor/domain";

import { ManualDraftEngine } from "./manual-draft-engine";

export class ManualDraftRepository {
  readonly #drafts = new Map<
    ManualDraftId,
    { documentId: DocumentId; engine: ManualDraftEngine }
  >();

  create(
    draftId: ManualDraftId,
    documentId: DocumentId,
    alpha: Uint8ClampedArray,
    width: number,
    height: number,
    baseline?: Uint8ClampedArray,
  ): ManualDraftEngine {
    if (this.#drafts.has(draftId))
      throw new Error(`Manual draft already exists: ${draftId}`);
    const engine = new ManualDraftEngine(alpha, width, height, baseline);
    this.#drafts.set(draftId, { documentId, engine });
    return engine;
  }

  get(draftId: ManualDraftId): ManualDraftEngine | null {
    return this.#drafts.get(draftId)?.engine ?? null;
  }

  release(draftId: ManualDraftId): boolean {
    return this.#drafts.delete(draftId);
  }

  releaseDocument(documentId: DocumentId): number {
    let released = 0;
    for (const [draftId, draft] of this.#drafts) {
      if (draft.documentId === documentId) {
        this.#drafts.delete(draftId);
        released += 1;
      }
    }
    return released;
  }

  get size(): number {
    return this.#drafts.size;
  }
  dispose(): void {
    this.#drafts.clear();
  }
}
