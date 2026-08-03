import { createActor } from "xstate";

import {
  createDocumentMachine,
  createWorkspaceMachine,
  getDocumentActorId,
  type DocumentActorRef,
} from "@/v2/application";
import type { DocumentId, DocumentState } from "@/v2/domain";

import { createNativeProcessingCancellationSource } from "../platform";
import { MagicCutoutController, MagicPredictionService } from "../magic-cutout";
import { ManualCutoutController } from "../manual-cutout";
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
  const {
    download,
    gateway,
    heavyJobs,
    ids,
    magicCandidates,
    magicCommitter,
    magicDrafts,
    magicWorker,
    manualCommitter,
    manualDrafts,
    repository,
  } = dependencies;
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
  const magicPredictor =
    options.magicPredictor ??
    new MagicPredictionService({
      candidates: magicCandidates,
      client: magicWorker,
      drafts: magicDrafts,
      artifactsFor(documentId) {
        if (snapshot.kind !== "document") return null;
        const document = snapshot.actor.getSnapshot().context.document;
        if (document.documentId !== documentId) return null;
        const baseValue =
          document.committed === null ? null : repository.read(document.committed.matte);
        return {
          source: document.source,
          revision: document.revision,
          baseMatte: baseValue instanceof Uint8ClampedArray ? baseValue.slice() : null,
        };
      },
      publish(correlation, progress) {
        if (snapshot.kind !== "document") return;
        const document = snapshot.actor.getSnapshot().context.document;
        const draft = document.activeDraft;
        if (
          document.documentId !== correlation.documentId ||
          draft?.kind !== "magic-cutout" ||
          draft.draftId !== correlation.draftId ||
          draft.draftRevision !== correlation.draftRevision
        ) {
          return;
        }
        publish({ ...snapshot, magicProgress: progress });
      },
    });
  const documentMachine = createDocumentMachine({
    artifacts: artifactEffects,
    cancellation: createNativeProcessingCancellationSource(),
    gateway,
    runIds: { next: ids.run },
    manualIds: { draft: ids.manualDraft, operation: ids.editOperation },
    magicIds: { draft: ids.magicDraft },
    manualCommitter,
    magicPredictor,
    magicCommitter,
  });
  const workspace = createActor(createWorkspaceMachine({ documentMachine }));
  workspace.start();
  const currentActor = (): DocumentActorRef | null =>
    snapshot.kind === "document" ? snapshot.actor : null;
  const manualController = new ManualCutoutController({
    actor: currentActor,
    documentId: () => currentDocumentId,
    drafts: manualDrafts,
    repository,
  });
  const magicController = new MagicCutoutController({
    actor: currentActor,
    candidates: magicCandidates,
    dimensions: () =>
      snapshot.kind === "document"
        ? { width: snapshot.width, height: snapshot.height }
        : null,
    documentId: () => currentDocumentId,
    drafts: magicDrafts,
    nextRunId: ids.run,
  });

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
      activeMagicPrediction: null,
      pendingMagicCommit: null,
      magicCandidates: [],
      activeDraft: null,
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
      magicProgress: null,
      previewUrl: preview?.url ?? null,
      resultUrl: null,
      width: prepared.width,
    });
    resultProjection.watch(actor, documentId, (resultUrl) => {
      if (snapshot.kind === "document") {
        if (snapshot.actor.getSnapshot().context.document.activeDraft === null) {
          manualDrafts.releaseDocument(documentId);
          magicDrafts.releaseDocument(documentId);
          magicCandidates.releaseDocument(documentId);
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
    magicWorker.reset();
    snapshot.actor.send({
      type: "COMMAND",
      command: { type: "RESET_DOCUMENT", documentId },
    });
    workspace.send({ type: "REMOVE_DOCUMENT", documentId });
    manualDrafts.releaseDocument(documentId);
    magicDrafts.releaseDocument(documentId);
    magicCandidates.releaseDocument(documentId);
    currentDocumentId = null;
    publish(emptySnapshot());
  }

  return {
    beginMagic() {
      magicController.begin();
    },
    beginManual() {
      manualController.begin();
    },
    applyManual() {
      manualController.apply();
    },
    cancelManual() {
      manualController.cancel();
    },
    cancelMagic() {
      magicController.cancel();
      magicWorker.reset();
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
      magicWorker.dispose();
      heavyJobs.dispose();
      magicCandidates.dispose();
      magicDrafts.dispose();
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
      return manualController.draft();
    },
    magicDraft() {
      return magicController.draft();
    },
    notifyMagicChanged() {
      const predictionActive =
        snapshot.kind === "document" &&
        snapshot.actor.getSnapshot().context.document.activeMagicPrediction !== null;
      magicController.notifyChanged();
      if (predictionActive) magicWorker.reset();
    },
    paintMagicCandidate(canvas, candidateId) {
      magicController.paintCandidate(canvas, candidateId);
    },
    notifyManualDirty() {
      manualController.notifyDirty();
    },
    undoManual() {
      manualController.undo();
    },
    redoManual() {
      manualController.redo();
    },
    undoMagic() {
      magicController.undo();
    },
    redoMagic() {
      magicController.redo();
    },
    predictMagic() {
      magicController.predict();
    },
    selectMagicCandidate(candidateId) {
      magicController.select(candidateId);
    },
    applyMagic() {
      magicController.apply();
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
