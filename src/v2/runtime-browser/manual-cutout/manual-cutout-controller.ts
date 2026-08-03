import type { DocumentActorRef } from "@/v2/application";
import type { DocumentId } from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";
import type { ManualDraftEngine } from "./manual-draft-engine";
import type { ManualDraftRepository } from "./manual-draft-repository";

export class ManualCutoutController {
  readonly #actor: () => DocumentActorRef | null;
  readonly #documentId: () => DocumentId | null;
  readonly #drafts: ManualDraftRepository;
  readonly #repository: ArtifactRepository;

  constructor(options: {
    actor(): DocumentActorRef | null;
    documentId(): DocumentId | null;
    drafts: ManualDraftRepository;
    repository: ArtifactRepository;
  }) {
    this.#actor = () => options.actor();
    this.#documentId = () => options.documentId();
    this.#drafts = options.drafts;
    this.#repository = options.repository;
  }

  begin(): void {
    const actor = this.#actor();
    const documentId = this.#documentId();
    if (actor === null || documentId === null) return;
    const document = actor.getSnapshot().context.document;
    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_MANUAL_CUTOUT",
        documentId,
        expectedRevision: document.revision,
      },
    });
    const next = actor.getSnapshot().context.document;
    if (next.activeDraft?.kind !== "manual-cutout" || next.committed === null) return;
    const value = this.#repository.read(next.committed.matte);
    const baselineValue =
      next.baseline === null ? null : this.#repository.read(next.baseline.matte);
    const metadata = this.#repository.metadata(next.committed.matte);
    if (
      !(value instanceof Uint8ClampedArray) ||
      !(baselineValue instanceof Uint8ClampedArray) ||
      metadata === null
    ) {
      return;
    }
    this.#drafts.create(
      next.activeDraft.draftId,
      documentId,
      value,
      metadata.width,
      metadata.height,
      baselineValue,
    );
  }

  apply(): void {
    const actor = this.#actor();
    const documentId = this.#documentId();
    if (actor === null || documentId === null) return;
    const document = actor.getSnapshot().context.document;
    if (
      document.activeDraft?.kind !== "manual-cutout" ||
      document.pendingManualCommit !== null
    ) {
      return;
    }
    const engine = this.#drafts.get(document.activeDraft.draftId);
    if (engine === null) return;
    const owner = {
      kind: "manual-draft",
      documentId,
      draftId: document.activeDraft.draftId,
    } as const;
    this.#repository.releaseOwnerIfPresent(owner);
    const draftMatte = this.#repository.register(
      engine.alphaCopy(),
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: engine.width,
        height: engine.height,
        estimatedBytes: engine.width * engine.height,
      },
      owner,
    );
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_MANUAL_CUTOUT",
        documentId,
        draftId: document.activeDraft.draftId,
        expectedRevision: document.revision,
        draftMatte,
      },
    });
  }

  cancel(): void {
    const actor = this.#actor();
    const documentId = this.#documentId();
    const draft = actor?.getSnapshot().context.document.activeDraft;
    if (actor === null || documentId === null || draft?.kind !== "manual-cutout") return;
    actor.send({
      type: "COMMAND",
      command: { type: "CANCEL_MANUAL_CUTOUT", documentId, draftId: draft.draftId },
    });
    this.#drafts.release(draft.draftId);
  }

  draft(): ManualDraftEngine | null {
    const draft = this.#actor()?.getSnapshot().context.document.activeDraft;
    return draft?.kind === "manual-cutout" ? this.#drafts.get(draft.draftId) : null;
  }

  notifyDirty(): void {
    const actor = this.#actor();
    const draft = actor?.getSnapshot().context.document.activeDraft;
    const engine =
      draft?.kind === "manual-cutout" ? this.#drafts.get(draft.draftId) : null;
    if (actor === null || draft?.kind !== "manual-cutout" || engine === null) return;
    actor.send({
      type: "DOMAIN_EVENT",
      event: {
        type: "MANUAL_DRAFT_DIRTY_CHANGED",
        documentId: draft.documentId,
        draftId: draft.draftId,
        dirty: engine.dirty,
      },
    });
  }

  undo(): void {
    if (this.draft()?.undo() !== null) this.notifyDirty();
  }

  redo(): void {
    if (this.draft()?.redo() !== null) this.notifyDirty();
  }
}
