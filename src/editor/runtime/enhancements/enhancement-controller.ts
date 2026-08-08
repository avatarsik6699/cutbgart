import type { DocumentMachineTypes } from "@/editor/application";
import { selectEnhancementDraft } from "@/editor/application";
import type { EnhancementDraftId, EnhancementTypes, RunId } from "@/editor/domain";

import type { EnhancementRuntimeService } from "./enhancement-commit-service";
import type { EnhancementDraftRepository } from "./enhancement-draft-repository";

export class EnhancementController {
  readonly #actor: () => DocumentMachineTypes.ActorRef | null;
  readonly #drafts: EnhancementDraftRepository;
  readonly #nextRunId: () => RunId;
  readonly #service: EnhancementRuntimeService;
  #capturedDraftId: EnhancementDraftId | null = null;

  constructor(options: {
    actor: () => DocumentMachineTypes.ActorRef | null;
    drafts: EnhancementDraftRepository;
    nextRunId: () => RunId;
    service: EnhancementRuntimeService;
  }) {
    this.#actor = options.actor;
    this.#drafts = options.drafts;
    this.#nextRunId = options.nextRunId;
    this.#service = options.service;
  }

  getSnapshot = (): ReturnType<EnhancementRuntimeService["getSnapshot"]> =>
    this.#service.getSnapshot();

  subscribe = (listener: () => void): (() => void) => this.#service.subscribe(listener);

  begin(): void {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    if (document.committed === null) return;
    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_ENHANCEMENTS",
        documentId: document.documentId,
        expectedRevision: document.revision,
      },
    });
    if (actor.getSnapshot().context.lastCommandOutcome?.status !== "accepted") return;
    const draft = selectEnhancementDraft(actor.getSnapshot());
    const current = actor.getSnapshot().context.document;
    if (draft === null || current.committed === null) return;
    try {
      this.#drafts.capture({
        documentId: current.documentId,
        draftId: draft.draftId,
        baselineRevision: draft.baselineRevision,
        source: current.source,
        snapshot: current.committed,
      });
      this.#capturedDraftId = draft.draftId;
    } catch (error) {
      actor.send({
        type: "COMMAND",
        command: {
          type: "CANCEL_ENHANCEMENTS",
          documentId: current.documentId,
          draftId: draft.draftId,
        },
      });
      this.#service.reportError(error);
    }
  }

  change(operationIds: readonly EnhancementTypes.OperationId[]): void {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    const draft = selectEnhancementDraft(actor.getSnapshot());
    if (draft === null) return;
    actor.send({
      type: "COMMAND",
      command: {
        type: "CHANGE_ENHANCEMENTS",
        documentId: document.documentId,
        draftId: draft.draftId,
        expectedRevision: document.revision,
        operationIds,
      },
    });
  }

  apply(): void {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    const draft = selectEnhancementDraft(actor.getSnapshot());
    if (draft === null) return;
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_ENHANCEMENTS",
        documentId: document.documentId,
        draftId: draft.draftId,
        runId: this.#nextRunId(),
        expectedRevision: document.revision,
      },
    });
  }

  retry(): void {
    this.apply();
  }

  cancel(): void {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    const draft = selectEnhancementDraft(actor.getSnapshot());
    if (draft === null) return;
    this.#drafts.release(document.documentId, draft.draftId);
    this.#capturedDraftId = null;
    actor.send({
      type: "COMMAND",
      command: {
        type: "CANCEL_ENHANCEMENTS",
        documentId: document.documentId,
        draftId: draft.draftId,
      },
    });
  }

  reconcile(): void {
    const draftId = this.#capturedDraftId;
    if (draftId === null) return;
    const actor = this.#actor();
    const draft = actor === null ? null : selectEnhancementDraft(actor.getSnapshot());
    if (draft?.draftId === draftId) return;
    this.#drafts.forget(draftId);
    this.#capturedDraftId = null;
  }

  reset(): void {
    const actor = this.#actor();
    const draftId = this.#capturedDraftId;
    if (actor !== null && draftId !== null) {
      const documentId = actor.getSnapshot().context.document.documentId;
      this.#drafts.release(documentId, draftId);
    }
    this.#capturedDraftId = null;
    this.#service.reset();
  }

  dispose(): void {
    this.reset();
    this.#service.dispose();
  }
}
