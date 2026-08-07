import type { DocumentMachineTypes } from "@/v2/application";
import type { DocumentId, MagicCandidateId, RunId } from "@/v2/domain";

import type { MagicCandidateRepository } from "./magic-candidate-repository";
import type { MagicDraftEngine } from "./magic-draft-engine";
import type { MagicDraftRepository } from "./magic-draft-repository";

export class MagicCutoutController {
  readonly #actor: () => DocumentMachineTypes.ActorRef | null;
  readonly #candidates: MagicCandidateRepository;
  readonly #dimensions: () => { width: number; height: number } | null;
  readonly #documentId: () => DocumentId | null;
  readonly #drafts: MagicDraftRepository;
  readonly #nextRunId: () => RunId;

  constructor(options: {
    actor(): DocumentMachineTypes.ActorRef | null;
    candidates: MagicCandidateRepository;
    dimensions(): { width: number; height: number } | null;
    documentId(): DocumentId | null;
    drafts: MagicDraftRepository;
    nextRunId(): RunId;
  }) {
    this.#actor = () => options.actor();
    this.#candidates = options.candidates;
    this.#dimensions = () => options.dimensions();
    this.#documentId = () => options.documentId();
    this.#drafts = options.drafts;
    this.#nextRunId = () => options.nextRunId();
  }

  begin(): void {
    const actor = this.#actor();
    const documentId = this.#documentId();
    const dimensions = this.#dimensions();
    if (actor === null || documentId === null || dimensions === null) return;
    const document = actor.getSnapshot().context.document;
    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_MAGIC_CUTOUT",
        documentId,
        expectedRevision: document.revision,
      },
    });
    const draft = actor.getSnapshot().context.document.activeDraft;
    if (draft?.kind !== "magic-cutout") return;
    this.#drafts.create({ documentId, draftId: draft.draftId, ...dimensions });
  }

  draft(): MagicDraftEngine | null {
    const draft = this.#actor()?.getSnapshot().context.document.activeDraft;
    return draft?.kind === "magic-cutout" ? this.#drafts.get(draft.draftId) : null;
  }

  notifyChanged(): void {
    const actor = this.#actor();
    const document = actor?.getSnapshot().context.document;
    const draft = document?.activeDraft;
    const engine =
      draft?.kind === "magic-cutout" ? this.#drafts.get(draft.draftId) : null;
    if (
      actor === null ||
      document === undefined ||
      draft?.kind !== "magic-cutout" ||
      engine === null
    ) {
      return;
    }
    const runtime = engine.snapshot();
    this.#candidates.releaseDraft(draft.draftId);
    actor.send({
      type: "COMMAND",
      command: {
        type: "MAGIC_DRAFT_CHANGED",
        documentId: document.documentId,
        draftId: draft.draftId,
        expectedRevision: document.revision,
        draftRevision: runtime.revision,
        dirty: runtime.dirty,
      },
    });
  }

  predict(): void {
    const actor = this.#actor();
    const document = actor?.getSnapshot().context.document;
    const draft = document?.activeDraft;
    if (actor === null || document === undefined || draft?.kind !== "magic-cutout")
      return;
    actor.send({
      type: "COMMAND",
      command: {
        type: "PREDICT_MAGIC_CUTOUT",
        documentId: document.documentId,
        draftId: draft.draftId,
        runId: this.#nextRunId(),
        expectedRevision: document.revision,
        draftRevision: draft.draftRevision,
      },
    });
  }

  select(candidateId: MagicCandidateId): void {
    const actor = this.#actor();
    const document = actor?.getSnapshot().context.document;
    const draft = document?.activeDraft;
    if (actor === null || document === undefined || draft?.kind !== "magic-cutout")
      return;
    if (
      !document.magicCandidates.some((candidate) => candidate.candidateId === candidateId)
    )
      return;
    if (!this.#candidates.selectPreview(draft.draftId, candidateId)) return;
    actor.send({
      type: "COMMAND",
      command: {
        type: "SELECT_MAGIC_CANDIDATE",
        documentId: document.documentId,
        draftId: draft.draftId,
        candidateId,
        expectedRevision: document.revision,
        draftRevision: draft.draftRevision,
      },
    });
  }

  paintCandidate(canvas: HTMLCanvasElement, candidateId: MagicCandidateId | null): void {
    const candidate = candidateId === null ? null : this.#candidates.preview(candidateId);
    const dimensions = this.#dimensions();
    if (dimensions === null) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (context === null) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (candidate === null) return;
    const overlay = context.createImageData(candidate.width, candidate.height);
    for (let index = 0; index < candidate.data.length; index += 1) {
      if ((candidate.data[index] ?? 0) >= 128) continue;
      overlay.data[index * 4] = 239;
      overlay.data[index * 4 + 1] = 68;
      overlay.data[index * 4 + 2] = 68;
      overlay.data[index * 4 + 3] = 92;
    }
    context.putImageData(overlay, 0, 0);
  }

  apply(): void {
    const actor = this.#actor();
    const document = actor?.getSnapshot().context.document;
    const draft = document?.activeDraft;
    if (
      actor === null ||
      document === undefined ||
      draft?.kind !== "magic-cutout" ||
      draft.selectedCandidateId === null ||
      document.pendingMagicCommit !== null
    ) {
      return;
    }
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_MAGIC_CUTOUT",
        documentId: document.documentId,
        draftId: draft.draftId,
        candidateId: draft.selectedCandidateId,
        expectedRevision: document.revision,
        draftRevision: draft.draftRevision,
      },
    });
  }

  cancel(): void {
    const actor = this.#actor();
    const documentId = this.#documentId();
    const draft = actor?.getSnapshot().context.document.activeDraft;
    if (actor === null || documentId === null || draft?.kind !== "magic-cutout") return;
    actor.send({
      type: "COMMAND",
      command: { type: "CANCEL_MAGIC_CUTOUT", documentId, draftId: draft.draftId },
    });
    this.#candidates.releaseDraft(draft.draftId);
    this.#drafts.release(draft.draftId);
  }

  undo(): void {
    if (this.draft()?.undo() !== null) this.notifyChanged();
  }

  redo(): void {
    if (this.draft()?.redo() !== null) this.notifyChanged();
  }
}
