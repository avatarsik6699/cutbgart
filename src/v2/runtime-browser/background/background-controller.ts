import type {
  DocumentActorRef,
  ProcessingCancellation,
  ProcessingCancellationSource,
} from "@/v2/application";
import { selectBackgroundDraft } from "@/v2/application";
import {
  normalizeBackgroundFill,
  type BackgroundDraftId,
  type BackgroundFillDescriptor,
} from "@/v2/domain";

import { BackgroundDraftRepository } from "./background-draft-repository";
import type { BackgroundImagePreparer } from "./background-image-client";
import { createNativeProcessingCancellationSource } from "../platform";

export type BackgroundRuntimeSnapshot = {
  status: "ready" | "preparing-image" | "error";
  previewUrl: string | null;
  error: string | null;
};

const READY_SNAPSHOT: BackgroundRuntimeSnapshot = {
  status: "ready",
  previewUrl: null,
  error: null,
};

export class BackgroundController {
  readonly #actor: () => DocumentActorRef | null;
  readonly #drafts: BackgroundDraftRepository;
  readonly #images: BackgroundImagePreparer;
  readonly #cancellation: ProcessingCancellationSource;
  readonly #listeners = new Set<() => void>();
  #preparation: ProcessingCancellation | null = null;
  #draftId: BackgroundDraftId | null = null;
  #sequence = 0;
  #snapshot = READY_SNAPSHOT;

  constructor(options: {
    actor: () => DocumentActorRef | null;
    drafts: BackgroundDraftRepository;
    images: BackgroundImagePreparer;
    cancellation?: ProcessingCancellationSource;
  }) {
    this.#actor = options.actor;
    this.#drafts = options.drafts;
    this.#images = options.images;
    this.#cancellation =
      options.cancellation ?? createNativeProcessingCancellationSource();
  }

  getSnapshot = (): BackgroundRuntimeSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  begin(): void {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    actor.send({
      type: "COMMAND",
      command: {
        type: "BEGIN_BACKGROUND",
        documentId: document.documentId,
        expectedRevision: document.revision,
      },
    });
    this.#draftId = selectBackgroundDraft(actor.getSnapshot())?.draftId ?? null;
    this.#publish(READY_SNAPSHOT);
  }

  apply(): void {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    const draft = selectBackgroundDraft(actor.getSnapshot());
    if (draft === null) return;
    actor.send({
      type: "COMMAND",
      command: {
        type: "APPLY_BACKGROUND",
        documentId: document.documentId,
        draftId: draft.draftId,
        expectedRevision: document.revision,
        draftRevision: draft.draftRevision,
      },
    });
  }

  change(fill: BackgroundFillDescriptor): void {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    const draft = selectBackgroundDraft(actor.getSnapshot());
    if (draft === null) return;
    const normalized = normalizeBackgroundFill(fill);
    if (normalized === null) {
      this.#publish({
        status: "error",
        previewUrl: this.#drafts.get(draft.draftId)?.previewUrl ?? null,
        error: "Invalid background fill",
      });
      return;
    }
    if (normalized.type !== "image")
      this.#drafts.release(document.documentId, draft.draftId);
    actor.send({
      type: "COMMAND",
      command: {
        type: "CHANGE_BACKGROUND",
        documentId: document.documentId,
        draftId: draft.draftId,
        expectedRevision: document.revision,
        draftRevision: draft.draftRevision + 1,
        fill: normalized,
      },
    });
    this.#publish({
      status: "ready",
      previewUrl:
        normalized.type === "image"
          ? (this.#drafts.get(draft.draftId)?.previewUrl ?? null)
          : null,
      error: null,
    });
  }

  async selectImage(file: File): Promise<void> {
    const actor = this.#actor();
    if (actor === null) return;
    const document = actor.getSnapshot().context.document;
    const draft = selectBackgroundDraft(actor.getSnapshot());
    if (draft === null) return;
    this.#preparation?.abort();
    const sequence = this.#sequence + 1;
    this.#sequence = sequence;
    const controller = this.#cancellation.create();
    this.#preparation = controller;
    const draftRevision = draft.draftRevision + 1;
    this.#publish({ status: "preparing-image", previewUrl: null, error: null });
    try {
      const prepared = await this.#images.prepare(
        file,
        {
          documentId: document.documentId,
          draftId: draft.draftId,
          draftRevision,
        },
        controller.signal,
      );
      if (sequence !== this.#sequence || controller.signal.aborted) return;
      const current = actor.getSnapshot().context.document;
      const currentDraft = selectBackgroundDraft(actor.getSnapshot());
      if (
        currentDraft?.draftId !== draft.draftId ||
        currentDraft.draftRevision + 1 !== draftRevision ||
        current.revision !== document.revision
      )
        return;
      const record = this.#drafts.replace(document.documentId, draft.draftId, prepared);
      this.change({ type: "image", artifactId: record.artifactId });
      this.#publish({ status: "ready", previewUrl: record.previewUrl, error: null });
    } catch (error) {
      if (sequence !== this.#sequence || controller.signal.aborted) return;
      this.#publish({
        status: "error",
        previewUrl: null,
        error: error instanceof Error ? error.message : "Background image failed",
      });
    } finally {
      if (this.#preparation === controller) this.#preparation = null;
    }
  }

  cancel(): void {
    this.#sequence += 1;
    this.#preparation?.abort();
    this.#preparation = null;
    const actor = this.#actor();
    if (actor === null) {
      this.#publish(READY_SNAPSHOT);
      return;
    }
    const document = actor.getSnapshot().context.document;
    const draft = selectBackgroundDraft(actor.getSnapshot());
    if (draft !== null) {
      this.#drafts.release(document.documentId, draft.draftId);
      this.#draftId = null;
      actor.send({
        type: "COMMAND",
        command: {
          type: "CANCEL_BACKGROUND",
          documentId: document.documentId,
          draftId: draft.draftId,
        },
      });
    }
    this.#publish(READY_SNAPSHOT);
  }

  reconcile(): void {
    const draftId = this.#draftId;
    if (draftId === null) return;
    const actor = this.#actor();
    const draft = actor === null ? null : selectBackgroundDraft(actor.getSnapshot());
    if (draft?.draftId === draftId) return;
    this.#drafts.forget(draftId);
    this.#draftId = null;
    this.#publish(READY_SNAPSHOT);
  }

  reset(): void {
    this.cancel();
  }

  dispose(): void {
    this.cancel();
    this.#listeners.clear();
  }

  #publish(snapshot: BackgroundRuntimeSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}
