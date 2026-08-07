import type { DocumentId, MagicDraftId } from "@/editor/domain";

import { MagicDraftEngine } from "./magic-draft-engine";

export class MagicDraftRepository {
  readonly #drafts = new Map<MagicDraftId, MagicDraftEngine>();

  create(options: {
    documentId: DocumentId;
    draftId: MagicDraftId;
    width: number;
    height: number;
  }): MagicDraftEngine {
    if (this.#drafts.has(options.draftId)) {
      throw new Error(`Magic draft already exists: ${options.draftId}`);
    }
    const draft = new MagicDraftEngine(options);
    this.#drafts.set(options.draftId, draft);
    return draft;
  }

  get(draftId: MagicDraftId): MagicDraftEngine | null {
    return this.#drafts.get(draftId) ?? null;
  }

  release(draftId: MagicDraftId): boolean {
    const draft = this.#drafts.get(draftId);
    if (draft === undefined) return false;
    draft.dispose();
    this.#drafts.delete(draftId);
    return true;
  }

  releaseDocument(documentId: DocumentId): number {
    let released = 0;
    for (const [draftId, draft] of this.#drafts) {
      if (draft.documentId !== documentId) continue;
      draft.dispose();
      this.#drafts.delete(draftId);
      released += 1;
    }
    return released;
  }

  dispose(): void {
    for (const draft of this.#drafts.values()) draft.dispose();
    this.#drafts.clear();
  }

  get size(): number {
    return this.#drafts.size;
  }
}
