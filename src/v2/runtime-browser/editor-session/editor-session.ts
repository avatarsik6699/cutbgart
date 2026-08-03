import { createActor } from "xstate";

import {
  createDocumentMachine,
  createWorkspaceMachine,
  getDocumentActorId,
  type DocumentActorRef,
} from "@/v2/application";
import type { DocumentId, DocumentState } from "@/v2/domain";

import { createNativeProcessingCancellationSource } from "../platform";
import { BackgroundController } from "../background";
import { EnhancementController } from "../enhancements";
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
    backgroundCommitter,
    backgroundDrafts,
    backgroundImages,
    download,
    gateway,
    heavyJobs,
    enhancementDrafts,
    enhancementService,
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
    finishingIds: {
      backgroundDraft: ids.backgroundDraft,
      enhancementDraft: ids.enhancementDraft,
      operation: ids.editOperation,
    },
    manualCommitter,
    magicPredictor,
    magicCommitter,
    backgroundCommitter,
    enhancementCommitter: enhancementService,
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
  const backgroundController = new BackgroundController({
    actor: currentActor,
    drafts: backgroundDrafts,
    images: backgroundImages,
  });
  const enhancementController = new EnhancementController({
    actor: currentActor,
    drafts: enhancementDrafts,
    nextRunId: ids.run,
    service: enhancementService,
  });
  let finishingActorSubscription: { unsubscribe(): void } | null = null;
  const stopBackgroundRuntime = backgroundController.subscribe(publishRuntime);
  const stopEnhancementRuntime = enhancementController.subscribe(publishRuntime);

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

  function publishRuntime(): void {
    if (snapshot.kind !== "document") return;
    publish({
      ...snapshot,
      backgroundRuntime: backgroundController.getSnapshot(),
      enhancementRuntime: enhancementController.getSnapshot(),
    });
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
      pendingBackgroundCommit: null,
      pendingEnhancementCommit: null,
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
      backgroundRuntime: backgroundController.getSnapshot(),
      error: null,
      fileName: file.name,
      foregroundUrl: null,
      height: prepared.height,
      enhancementRuntime: enhancementController.getSnapshot(),
      magicProgress: null,
      previewUrl: preview?.url ?? null,
      resultUrl: null,
      width: prepared.width,
    });
    finishingActorSubscription = actor.subscribe(() => {
      backgroundController.reconcile();
      enhancementController.reconcile();
      publishRuntime();
    });
    resultProjection.watch(actor, documentId, (resultUrl, foregroundUrl) => {
      if (snapshot.kind === "document") {
        if (snapshot.actor.getSnapshot().context.document.activeDraft === null) {
          manualDrafts.releaseDocument(documentId);
          magicDrafts.releaseDocument(documentId);
          magicCandidates.releaseDocument(documentId);
        }
        publish({ ...snapshot, foregroundUrl, resultUrl });
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
    finishingActorSubscription?.unsubscribe();
    finishingActorSubscription = null;
    backgroundController.reset();
    enhancementController.reset();
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
    applyBackground() {
      backgroundController.apply();
    },
    applyEnhancements() {
      enhancementController.apply();
    },
    beginBackground() {
      backgroundController.begin();
    },
    beginEnhancements() {
      enhancementController.begin();
    },
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
    cancelBackground() {
      backgroundController.cancel();
    },
    cancelEnhancements() {
      enhancementController.cancel();
    },
    changeBackground(fill) {
      backgroundController.change(fill);
    },
    changeEnhancements(operationIds) {
      enhancementController.change(operationIds);
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
      backgroundController.dispose();
      enhancementController.dispose();
      magicWorker.dispose();
      heavyJobs.dispose();
      magicCandidates.dispose();
      magicDrafts.dispose();
      repository.dispose();
      manualDrafts.dispose();
      stopBackgroundRuntime();
      stopEnhancementRuntime();
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
    retryEnhancements() {
      enhancementController.retry();
    },
    selectBackgroundImage(file) {
      return backgroundController.selectImage(file);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
