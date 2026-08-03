import { createActor } from "xstate";

import {
  createDocumentMachine,
  createWorkspaceMachine,
  getDocumentActorId,
  type DocumentActorRef,
} from "@/v2/application";
import type { DocumentId, DocumentState } from "@/v2/domain";

import { createNativeProcessingCancellationSource } from "../platform";
import { createEditorArtifactEffects } from "./editor-artifact-effects";
import { DocumentResultProjection } from "./document-result-projection";
import { createEditorSessionDependencies } from "./editor-session-dependencies";
import type {
  EditorSession,
  EditorSessionOptions,
  EditorSessionSnapshot,
} from "./editor-session.types";
import { prepareImageImport } from "./image-import-preparation";

export function createEditorSession(options: EditorSessionOptions = {}): EditorSession {
  const dependencies = createEditorSessionDependencies(options);
  const { download, gateway, ids, manualCommitter, manualDrafts, repository } =
    dependencies;
  const listeners = new Set<() => void>();
  let currentDocumentId: DocumentId | null = null;
  let disposed = false;
  let importing = false;
  const resultProjection = new DocumentResultProjection(repository);
  let snapshot: EditorSessionSnapshot = {
    kind: "empty",
    actor: null,
    error: null,
    fileName: null,
    height: null,
    previewUrl: null,
    resultUrl: null,
    width: null,
  };

  const artifactEffects = createEditorArtifactEffects({
    download,
    fileName: () => snapshot.fileName,
    repository,
  });
  const documentMachine = createDocumentMachine({
    artifacts: artifactEffects,
    cancellation: createNativeProcessingCancellationSource(),
    gateway,
    runIds: { next: ids.run },
    manualIds: { draft: ids.manualDraft, operation: ids.editOperation },
    manualCommitter,
  });
  const workspace = createActor(createWorkspaceMachine({ documentMachine }));
  workspace.start();

  function emptySnapshot(
    error: Extract<EditorSessionSnapshot, { kind: "empty" }>["error"] = null,
  ): EditorSessionSnapshot {
    return {
      kind: "empty",
      actor: null,
      error,
      fileName: null,
      height: null,
      previewUrl: null,
      resultUrl: null,
      width: null,
    };
  }

  function publish(next: EditorSessionSnapshot): void {
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }

  async function performImport(file: File): Promise<void> {
    publish({
      kind: "preparing",
      actor: null,
      error: null,
      fileName: file.name,
      height: null,
      previewUrl: null,
      resultUrl: null,
      width: null,
    });
    const preparation = await prepareImageImport(file);
    if (disposed) {
      return;
    }
    if (!preparation.ok) {
      publish(emptySnapshot(preparation.error));
      return;
    }
    const prepared = preparation.value;

    const documentId = ids.document();
    const source = repository.register(
      file,
      {
        kind: "source",
        mediaType: prepared.mediaType,
        width: prepared.width,
        height: prepared.height,
        estimatedBytes: file.size,
      },
      { kind: "document", documentId },
    );
    const preview = repository.createObjectUrl(source, { kind: "preview", documentId });
    const document: DocumentState = {
      documentId,
      imageId: ids.image(),
      source,
      revision: 0,
      committed: null,
      baseline: null,
      activeRun: null,
      pendingCommit: null,
      pendingManualCommit: null,
      manualDraft: null,
      history: { past: [], future: [], retainedHistoricalBytes: 0 },
      status: "preparing",
      stage: null,
      progress: null,
      error: null,
    };
    currentDocumentId = documentId;
    workspace.send({ type: "REGISTER_DOCUMENT", document });
    const child = workspace.getSnapshot().children[getDocumentActorId(documentId)];
    if (child === undefined) {
      repository.releaseOwnerIfPresent({ kind: "preview", documentId });
      repository.releaseOwnerIfPresent({ kind: "document", documentId });
      publish(emptySnapshot("preparation-failed"));
      return;
    }
    const actor = child as DocumentActorRef;
    publish({
      kind: "document",
      actor,
      error: null,
      fileName: file.name,
      height: prepared.height,
      previewUrl: preview?.url ?? null,
      resultUrl: null,
      width: prepared.width,
    });
    resultProjection.watch(actor, documentId, (resultUrl) => {
      if (snapshot.kind === "document") {
        if (snapshot.actor.getSnapshot().context.document.manualDraft === null) {
          manualDrafts.releaseDocument(documentId);
        }
        publish({ ...snapshot, resultUrl });
      }
    });
    actor.send({
      type: "DOMAIN_EVENT",
      event: { type: "PREPARATION_SUCCEEDED", documentId },
    });
  }

  async function importImage(file: File): Promise<void> {
    if (disposed || importing || snapshot.kind !== "empty") {
      return;
    }
    importing = true;
    try {
      await performImport(file);
    } finally {
      importing = false;
    }
  }

  function reset(): void {
    const documentId = currentDocumentId;
    if (snapshot.kind !== "document" || documentId === null) {
      return;
    }
    resultProjection.stop();
    snapshot.actor.send({
      type: "COMMAND",
      command: { type: "RESET_DOCUMENT", documentId },
    });
    workspace.send({ type: "REMOVE_DOCUMENT", documentId });
    manualDrafts.releaseDocument(documentId);
    currentDocumentId = null;
    publish(emptySnapshot());
  }

  return {
    beginManual() {
      if (snapshot.kind !== "document" || currentDocumentId === null) return;
      const document = snapshot.actor.getSnapshot().context.document;
      snapshot.actor.send({
        type: "COMMAND",
        command: {
          type: "BEGIN_MANUAL_CUTOUT",
          documentId: currentDocumentId,
          expectedRevision: document.revision,
        },
      });
      const next = snapshot.actor.getSnapshot().context.document;
      if (next.manualDraft === null || next.committed === null) return;
      const value = repository.read(next.committed.matte);
      const baselineValue =
        next.baseline === null ? null : repository.read(next.baseline.matte);
      const metadata = repository.metadata(next.committed.matte);
      if (
        !(value instanceof Uint8ClampedArray) ||
        !(baselineValue instanceof Uint8ClampedArray) ||
        metadata === null
      )
        return;
      manualDrafts.create(
        next.manualDraft.draftId,
        currentDocumentId,
        value,
        metadata.width,
        metadata.height,
        baselineValue,
      );
    },
    applyManual() {
      if (snapshot.kind !== "document" || currentDocumentId === null) return;
      const document = snapshot.actor.getSnapshot().context.document;
      if (document.manualDraft === null || document.pendingManualCommit !== null) return;
      const engine = manualDrafts.get(document.manualDraft.draftId);
      if (engine === null) return;
      const draftOwner = {
        kind: "manual-draft",
        documentId: currentDocumentId,
        draftId: document.manualDraft.draftId,
      } as const;
      repository.releaseOwnerIfPresent(draftOwner);
      const draftMatte = repository.register(
        engine.alphaCopy(),
        {
          kind: "matte",
          mediaType: "application/octet-stream",
          width: engine.width,
          height: engine.height,
          estimatedBytes: engine.width * engine.height,
        },
        draftOwner,
      );
      snapshot.actor.send({
        type: "COMMAND",
        command: {
          type: "APPLY_MANUAL_CUTOUT",
          documentId: currentDocumentId,
          draftId: document.manualDraft.draftId,
          expectedRevision: document.revision,
          draftMatte,
        },
      });
    },
    cancelManual() {
      if (snapshot.kind !== "document" || currentDocumentId === null) return;
      const draft = snapshot.actor.getSnapshot().context.document.manualDraft;
      if (draft === null) return;
      snapshot.actor.send({
        type: "COMMAND",
        command: {
          type: "CANCEL_MANUAL_CUTOUT",
          documentId: currentDocumentId,
          draftId: draft.draftId,
        },
      });
      manualDrafts.release(draft.draftId);
    },
    cancel() {
      if (snapshot.kind === "document" && currentDocumentId !== null) {
        snapshot.actor.send({
          type: "COMMAND",
          command: { type: "CANCEL_ACTIVE_RUN", documentId: currentDocumentId },
        });
      }
    },
    async dispose() {
      if (disposed) {
        return;
      }
      reset();
      disposed = true;
      workspace.send({ type: "DISPOSE" });
      workspace.stop();
      await gateway.dispose();
      repository.dispose();
      manualDrafts.dispose();
      listeners.clear();
    },
    exportPng() {
      const documentId = currentDocumentId;
      if (snapshot.kind !== "document" || documentId === null) {
        return;
      }
      snapshot.actor.send({
        type: "COMMAND",
        command: {
          type: "EXPORT_PNG",
          documentId,
          expectedRevision: snapshot.actor.getSnapshot().context.document.revision,
        },
      });
    },
    getSnapshot: () => snapshot,
    manualDraft() {
      if (snapshot.kind !== "document") return null;
      const draft = snapshot.actor.getSnapshot().context.document.manualDraft;
      return draft === null ? null : manualDrafts.get(draft.draftId);
    },
    notifyManualDirty() {
      if (snapshot.kind !== "document") return;
      const draft = snapshot.actor.getSnapshot().context.document.manualDraft;
      const engine = draft === null ? null : manualDrafts.get(draft.draftId);
      if (draft === null || engine === null) return;
      snapshot.actor.send({
        type: "DOMAIN_EVENT",
        event: {
          type: "MANUAL_DRAFT_DIRTY_CHANGED",
          documentId: draft.documentId,
          draftId: draft.draftId,
          dirty: engine.dirty,
        },
      });
    },
    undoManual() {
      const engine = this.manualDraft();
      if (engine?.undo() !== null) this.notifyManualDirty();
    },
    redoManual() {
      const engine = this.manualDraft();
      if (engine?.redo() !== null) this.notifyManualDirty();
    },
    undoDocument() {
      if (snapshot.kind !== "document" || currentDocumentId === null) return;
      const revision = snapshot.actor.getSnapshot().context.document.revision;
      snapshot.actor.send({
        type: "COMMAND",
        command: {
          type: "UNDO_DOCUMENT",
          documentId: currentDocumentId,
          expectedRevision: revision,
        },
      });
    },
    redoDocument() {
      if (snapshot.kind !== "document" || currentDocumentId === null) return;
      const revision = snapshot.actor.getSnapshot().context.document.revision;
      snapshot.actor.send({
        type: "COMMAND",
        command: {
          type: "REDO_DOCUMENT",
          documentId: currentDocumentId,
          expectedRevision: revision,
        },
      });
    },
    resources: () => repository.stats(),
    importImage,
    reset,
    retry() {
      if (snapshot.kind === "document" && currentDocumentId !== null) {
        snapshot.actor.send({
          type: "COMMAND",
          command: {
            type: "START_AUTOMATIC_REMOVAL",
            documentId: currentDocumentId,
            backend: "local",
          },
        });
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
