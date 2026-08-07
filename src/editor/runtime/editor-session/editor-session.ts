import { createActor } from "xstate";

import {
  createDocumentMachine,
  createWorkspaceMachine,
  getDocumentActorId,
  type DocumentMachineTypes,
  type ProcessingCancellation,
} from "@/editor/application";
import {
  createWorkspaceItemId,
  type DocumentId,
  type DocumentState,
  type WorkspaceItemId,
} from "@/editor/domain";
import {
  PRODUCTION_MODELS,
  type AutomaticModelMode,
  type BrowserInferencePath,
} from "@/shared/lib";

import { BatchExportCoordinator } from "../batch-export";
import { BatchImportCoordinator, WORKSPACE_ITEM_LIMIT } from "../batch-import";
import { MagicPredictionService } from "../magic-cutout";
import { createNativeProcessingCancellationSource, startBlobDownload } from "../platform";
import { createEditorArtifactEffects } from "./editor-artifact-effects";
import { createEditorSessionDependencies } from "./editor-session-dependencies";
import type { EditorSessionTypes } from "./editor-session.types";
import { DocumentRuntime } from "./document-runtime";
import { exportFileName, resizeExportPng, selectedExportDimensions } from "../export";
import type { ExportSize } from "@/editor/domain";
import {
  detectBrowserProcessingCapabilities,
  resolveUsableInferencePath,
} from "../processing";

type ItemRecord = {
  itemId: WorkspaceItemId;
  file: File;
  documentId: DocumentId | null;
  runtime: DocumentRuntime | null;
  error: EditorSessionTypes.ImportError | null;
  preparing: boolean;
  removed: boolean;
  modelMode: AutomaticModelMode;
  requestedModelMode: AutomaticModelMode;
  inferencePath: BrowserInferencePath | null;
};

const WEBGPU_MODEL_MODES = Object.freeze(PRODUCTION_MODELS.map((model) => model.id));
const WASM_MODEL_MODES = Object.freeze(
  PRODUCTION_MODELS.filter((model) =>
    (model.supportedPaths as readonly BrowserInferencePath[]).includes("wasm"),
  ).map((model) => model.id),
);

function documentState(
  documentId: DocumentId,
  imageId: DocumentState["imageId"],
  source: DocumentState["source"],
): DocumentState {
  return {
    documentId,
    imageId,
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
    automaticReprocessError: null,
  };
}

function itemStatus(item: ItemRecord): EditorSessionTypes.ItemStatus {
  if (item.preparing) return "preparing";
  if (item.error !== null || item.runtime === null) return "error";
  const status = item.runtime.actor.getSnapshot().context.document.status;
  if (status === "result") return "result";
  if (status === "error") return "error";
  if (status === "queued" || status === "enhancement-queued") return "queued";
  if (status === "model-loading") return "model-loading";
  return "processing";
}

export function createEditorSession(
  options: EditorSessionTypes.Options = {},
): EditorSessionTypes.Session {
  const activeListeners = new Set<() => void>();
  const listeners = new Set<() => void>();
  const items: ItemRecord[] = [];
  const dependencies = createEditorSessionDependencies(options, {
    onExecutionSelected(request, selection) {
      const item = items.find(
        (candidate) => !candidate.removed && candidate.documentId === request.documentId,
      );
      const activeRun = item?.runtime?.actor.getSnapshot().context.document.activeRun;
      if (
        item === undefined ||
        activeRun == null ||
        activeRun.runId !== request.runId ||
        activeRun.expectedRevision !== request.expectedRevision
      )
        return;
      item.modelMode = selection.modelMode;
      item.inferencePath = selection.inferencePath;
      publish();
    },
  });
  const runtimes = new Map<DocumentId, DocumentRuntime>();
  const imports = new BatchImportCoordinator();
  const batchExport = new BatchExportCoordinator({
    download: dependencies.download,
    repository: dependencies.repository,
  });
  let disposed = false;
  let itemSequence = 0;
  const exportCancellationSource = createNativeProcessingCancellationSource();
  let exportCancellation: ProcessingCancellation | null = null;
  let singleExport: EditorSessionTypes.SingleExportSnapshot = {
    status: "idle",
    error: null,
    size: null,
  };

  const artifactEffects = createEditorArtifactEffects({
    download: dependencies.download,
    fileName(documentId) {
      return runtimes.get(documentId)?.getSnapshot().fileName ?? null;
    },
    repository: dependencies.repository,
  });
  const magicPredictor =
    options.magicPredictor ??
    new MagicPredictionService({
      candidates: dependencies.magicCandidates,
      client: dependencies.magicWorker,
      drafts: dependencies.magicDrafts,
      artifactsFor(documentId) {
        const runtime = runtimes.get(documentId);
        if (runtime === undefined) return null;
        const document = runtime.actor.getSnapshot().context.document;
        const baseValue =
          document.committed === null
            ? null
            : dependencies.repository.read(document.committed.matte);
        return {
          source: document.source,
          revision: document.revision,
          baseMatte: baseValue instanceof Uint8ClampedArray ? baseValue.slice() : null,
        };
      },
      publish(correlation, progress) {
        const runtime = runtimes.get(correlation.documentId);
        if (runtime === undefined) return;
        const document = runtime.actor.getSnapshot().context.document;
        const draft = document.activeDraft;
        if (
          draft?.kind === "magic-cutout" &&
          draft.draftId === correlation.draftId &&
          draft.draftRevision === correlation.draftRevision
        )
          runtime.setMagicProgress(progress);
      },
    });
  const documentMachine = createDocumentMachine({
    artifacts: artifactEffects,
    cancellation: createNativeProcessingCancellationSource(),
    gateway: dependencies.gateway,
    runIds: { next: dependencies.ids.run },
    manualIds: {
      draft: dependencies.ids.manualDraft,
      operation: dependencies.ids.editOperation,
    },
    magicIds: { draft: dependencies.ids.magicDraft },
    finishingIds: {
      backgroundDraft: dependencies.ids.backgroundDraft,
      enhancementDraft: dependencies.ids.enhancementDraft,
      operation: dependencies.ids.editOperation,
    },
    manualCommitter: dependencies.manualCommitter,
    magicPredictor,
    magicCommitter: dependencies.magicCommitter,
    backgroundCommitter: dependencies.backgroundCommitter,
    enhancementCommitter: dependencies.enhancementService,
  });
  const workspace = createActor(createWorkspaceMachine({ documentMachine }));
  workspace.start();

  let snapshot: EditorSessionTypes.Snapshot = {
    kind: "empty",
    actor: null,
    error: null,
    fileName: null,
    height: null,
    previewUrl: null,
    resultUrl: null,
    width: null,
  };
  let cachedWorkspaceSnapshot: EditorSessionTypes.WorkspaceSnapshot | null = null;

  function publish(): void {
    cachedWorkspaceSnapshot = null;
    const next = computeSnapshot();
    snapshot = next.kind === "document" ? { ...next } : next;
    for (const listener of activeListeners) listener();
    for (const listener of listeners) listener();
  }

  function publishDocument(): void {
    cachedWorkspaceSnapshot = null;
    if (snapshot.kind === "document") snapshot = { ...snapshot };
    for (const listener of listeners) listener();
  }

  const stopExport = batchExport.subscribe(publish);

  function selectedRuntime(): DocumentRuntime | null {
    const selected = workspace.getSnapshot().context.selectedDocumentId;
    return selected === null ? null : (runtimes.get(selected) ?? null);
  }

  function emptySnapshot(
    error: EditorSessionTypes.ImportError | null,
  ): EditorSessionTypes.Snapshot {
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

  function computeSnapshot(): EditorSessionTypes.Snapshot {
    const selected = selectedRuntime();
    if (selected !== null) return selected.getSnapshot();
    const preparing = items.find((item) => !item.removed && item.preparing);
    if (preparing !== undefined)
      return {
        kind: "preparing",
        actor: null,
        error: null,
        fileName: preparing.file.name,
        height: null,
        previewUrl: null,
        resultUrl: null,
        width: null,
      };
    const failed = items.find((item) => !item.removed && item.error !== null);
    return emptySnapshot(failed?.error ?? null);
  }

  function getSnapshot(): EditorSessionTypes.Snapshot {
    return snapshot;
  }

  function computeWorkspaceSnapshot(): EditorSessionTypes.WorkspaceSnapshot {
    const visible = items.filter((item) => !item.removed);
    let queued = 0;
    return {
      itemIds: visible.map((item) => item.itemId),
      selectedDocumentId: workspace.getSnapshot().context.selectedDocumentId,
      items: visible.map((item) => {
        const status = itemStatus(item);
        const queuePosition = status === "queued" ? ++queued : null;
        const document = item.runtime?.actor.getSnapshot().context.document;
        const documentError = document?.error ?? null;
        return {
          itemId: item.itemId,
          documentId: item.documentId,
          fileName: item.file.name,
          status,
          error: item.error ?? documentError,
          previewUrl: item.runtime?.getSnapshot().previewUrl ?? null,
          queuePosition,
          qualityMode: document?.committed?.automaticModelMode ?? item.modelMode,
        };
      }),
      export: batchExport.getSnapshot(),
    };
  }

  function workspaceSnapshot(): EditorSessionTypes.WorkspaceSnapshot {
    cachedWorkspaceSnapshot ??= computeWorkspaceSnapshot();
    return cachedWorkspaceSnapshot;
  }

  function nextItemId(): WorkspaceItemId {
    return (
      dependencies.ids.workspaceItem?.() ??
      createWorkspaceItemId(`item-${++itemSequence}`)
    );
  }

  function registerPrepared(
    item: ItemRecord,
    prepared: {
      file: File;
      mediaType: "image/jpeg" | "image/png" | "image/webp";
      width: number;
      height: number;
    },
  ): void {
    if (disposed || item.removed) return;
    const documentId = dependencies.ids.document();
    let source: DocumentState["source"] | null = null;
    let registered = false;
    try {
      source = dependencies.repository.register(
        prepared.file,
        {
          kind: "source",
          mediaType: prepared.mediaType,
          width: prepared.width,
          height: prepared.height,
          estimatedBytes: prepared.file.size,
        },
        { kind: "document", documentId },
      );
      const preview = dependencies.repository.createObjectUrl(source, {
        kind: "preview",
        documentId,
      });
      workspace.send({
        type: "REGISTER_DOCUMENT",
        document: documentState(documentId, dependencies.ids.image(), source),
      });
      const registration = workspace.getSnapshot().context.lastCommandOutcome;
      if (
        registration?.status !== "accepted" ||
        registration.command !== "REGISTER_DOCUMENT" ||
        registration.documentId !== documentId
      )
        throw new Error("Document registration was rejected");
      registered = true;
      const child = workspace.getSnapshot().children[getDocumentActorId(documentId)];
      if (child === undefined) throw new Error("Document actor was not registered");
      const runtime = new DocumentRuntime({
        actor: child as DocumentMachineTypes.ActorRef,
        dependencies,
        documentId,
        fileName: item.file.name,
        height: prepared.height,
        onChange: publish,
        onDocumentChange: publishDocument,
        previewUrl: preview?.url ?? null,
        width: prepared.width,
      });
      item.documentId = documentId;
      item.runtime = runtime;
      item.error = null;
      item.preparing = false;
      runtimes.set(documentId, runtime);
      runtime.actor.send({
        type: "DOMAIN_EVENT",
        event: {
          type: "PREPARATION_SUCCEEDED",
          documentId,
          modelMode: item.modelMode,
        },
      });
    } catch {
      if (registered) workspace.send({ type: "REMOVE_DOCUMENT", documentId });
      if (source !== null) dependencies.repository.releaseDocumentScopes(documentId);
      item.error = "preparation-failed";
      item.preparing = false;
    }
  }

  async function importImages(
    files: readonly File[],
    modelMode: AutomaticModelMode = "isnet-q8",
  ): Promise<void> {
    if (disposed || files.length === 0) return;
    const capacity = WORKSPACE_ITEM_LIMIT - items.filter((item) => !item.removed).length;
    const acceptedFiles = files.slice(0, Math.max(0, capacity));
    const records = acceptedFiles.map((file) => {
      const item: ItemRecord = {
        itemId: nextItemId(),
        file,
        documentId: null,
        runtime: null,
        error: null,
        preparing: true,
        removed: false,
        modelMode,
        requestedModelMode: modelMode,
        inferencePath: null,
      };
      items.push(item);
      return item;
    });
    publish();
    const capabilities = detectBrowserProcessingCapabilities();
    const requestedPath = capabilities.webGpu === "supported" ? "webgpu" : "wasm";
    const inferencePath = await resolveUsableInferencePath(requestedPath);
    for (const item of records) {
      if (disposed || item.removed) continue;
      item.inferencePath = inferencePath;
      item.modelMode =
        item.requestedModelMode === "ben2-fp16" && inferencePath !== "webgpu"
          ? "isnet-fp32"
          : item.requestedModelMode;
    }
    publish();
    const results = await Promise.all(
      records.map((item) => imports.prepare({ itemId: item.itemId, file: item.file })),
    );
    for (const [index, result] of results.entries()) {
      const item = records[index];
      if (item === undefined || item.removed || disposed) continue;
      if (!result.ok) {
        item.preparing = false;
        if (result.error !== "cancelled") item.error = result.error;
        continue;
      }
      registerPrepared(item, result.value);
    }
    publish();
  }

  function removeItem(itemId: WorkspaceItemId): void {
    const item = items.find(
      (candidate) => candidate.itemId === itemId && !candidate.removed,
    );
    if (item === undefined) return;
    item.removed = true;
    imports.cancel(itemId);
    if (item.documentId !== null) {
      item.runtime?.dispose();
      item.runtime?.actor.send({
        type: "COMMAND",
        command: { type: "RESET_DOCUMENT", documentId: item.documentId },
      });
      runtimes.delete(item.documentId);
      workspace.send({ type: "REMOVE_DOCUMENT", documentId: item.documentId });
      dependencies.repository.releaseDocumentScopes(item.documentId);
    }
    publish();
  }

  const selected = () => selectedRuntime();

  function availableModelModes(): readonly AutomaticModelMode[] {
    const item = items.find(
      (candidate) =>
        !candidate.removed && candidate.documentId === selected()?.documentId,
    );
    return item?.inferencePath === "webgpu" ? WEBGPU_MODEL_MODES : WASM_MODEL_MODES;
  }

  return {
    availableModelModes,
    applyBackground: () => selected()?.applyBackground(),
    applyEnhancements: () => selected()?.applyEnhancements(),
    applyMagic: () => selected()?.applyMagic(),
    applyManual: () => selected()?.applyManual(),
    beginBackground: () => selected()?.beginBackground(),
    beginEnhancements: () => selected()?.beginEnhancements(),
    beginMagic: () => selected()?.beginMagic(),
    beginManual: () => selected()?.beginManual(),
    cancelBackground: () => selected()?.cancelBackground(),
    cancelEnhancements: () => selected()?.cancelEnhancements(),
    cancelMagic: () => selected()?.cancelMagic(),
    cancelManual: () => selected()?.cancelManual(),
    changeBackground: (fill) => selected()?.changeBackground(fill),
    changeEnhancements: (ids) => selected()?.changeEnhancements(ids),
    cancel() {
      const runtime = selected();
      if (runtime === null) return;
      runtime.actor.send({
        type: "COMMAND",
        command: { type: "CANCEL_ACTIVE_RUN", documentId: runtime.documentId },
      });
    },
    cancelExportAll() {
      batchExport.cancel();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      imports.dispose();
      batchExport.dispose();
      stopExport();
      exportCancellation?.abort();
      for (const item of [...items]) if (!item.removed) removeItem(item.itemId);
      workspace.send({ type: "DISPOSE" });
      workspace.stop();
      await dependencies.gateway.dispose();
      dependencies.disposeEnhancementServices();
      dependencies.magicWorker.dispose();
      dependencies.heavyJobs.dispose();
      dependencies.magicCandidates.dispose();
      dependencies.magicDrafts.dispose();
      dependencies.repository.dispose();
      dependencies.manualDrafts.dispose();
      activeListeners.clear();
      listeners.clear();
    },
    async exportPng(size: ExportSize = "original") {
      const runtime = selected();
      if (runtime === null) return;
      const document = runtime.actor.getSnapshot().context.document;
      if (document.committed === null) return;
      if (size !== "original") {
        const value = dependencies.repository.read(document.committed.composite);
        if (!(value instanceof Blob)) return;
        exportCancellation?.abort();
        const cancellation = exportCancellationSource.create();
        exportCancellation = cancellation;
        singleExport = { status: "preparing", error: null, size };
        publish();
        try {
          const dimensions = selectedExportDimensions(
            { width: runtime.getSnapshot().width, height: runtime.getSnapshot().height },
            size,
          );
          const output = await resizeExportPng(value, dimensions, cancellation.signal);
          if (cancellation.signal.aborted) {
            singleExport = { status: "cancelled", error: null, size };
            return;
          }
          startBlobDownload(dependencies.download, output, exportFileName(size));
          singleExport = { status: "succeeded", error: null, size };
        } catch (error) {
          singleExport = cancellation.signal.aborted
            ? { status: "cancelled", error: null, size }
            : {
                status: "error",
                error: error instanceof Error ? error.message : "Export failed",
                size,
              };
        } finally {
          if (exportCancellation === cancellation) exportCancellation = null;
          publish();
        }
        return;
      }
      runtime.actor.send({
        type: "COMMAND",
        command: {
          type: "EXPORT_PNG",
          documentId: runtime.documentId,
          expectedRevision: document.revision,
        },
      });
      singleExport = { status: "succeeded", error: null, size };
      publish();
    },
    exportAll() {
      const completed = items.flatMap((item) => {
        const document = item.runtime?.actor.getSnapshot().context.document;
        return item.removed || document?.committed === null || document === undefined
          ? []
          : [{ documentId: document.documentId, snapshot: document.committed }];
      });
      return batchExport.export(completed, items.filter((item) => !item.removed).length);
    },
    exportItemPng(documentId) {
      const runtime = runtimes.get(documentId);
      if (runtime === undefined) return;
      const document = runtime.actor.getSnapshot().context.document;
      if (document.committed === null) return;
      runtime.actor.send({
        type: "COMMAND",
        command: {
          type: "EXPORT_PNG",
          documentId,
          expectedRevision: document.revision,
        },
      });
    },
    getSnapshot,
    importImage: (file, modelMode) => importImages([file], modelMode),
    importImages,
    magicDraft: () => selected()?.magicDraft() ?? null,
    magicViewState: () => selected()?.magicViewState() ?? { mode: "keep", radius: 18 },
    setMagicViewState: (state) => selected()?.setMagicViewState(state),
    manualDraft: () => selected()?.manualDraft() ?? null,
    manualViewState: () =>
      selected()?.manualViewState() ?? { mode: "erase", brushSize: 48, zoom: 1 },
    setManualViewState: (state) => selected()?.setManualViewState(state),
    notifyMagicChanged: () => selected()?.notifyMagicChanged(),
    notifyManualDirty: () => selected()?.notifyManualDirty(),
    paintMagicCandidate: (canvas, id) => selected()?.paintMagicCandidate(canvas, id),
    predictMagic: () => selected()?.predictMagic(),
    redoMagic: () => selected()?.redoMagic(),
    redoManual: () => selected()?.redoManual(),
    redoDocument() {
      const runtime = selected();
      if (runtime === null) return;
      const revision = runtime.actor.getSnapshot().context.document.revision;
      runtime.actor.send({
        type: "COMMAND",
        command: {
          type: "REDO_DOCUMENT",
          documentId: runtime.documentId,
          expectedRevision: revision,
        },
      });
    },
    removeItem,
    reset() {
      exportCancellation?.abort();
      singleExport = { status: "idle", error: null, size: null };
      const selectedDocumentId = selected()?.documentId ?? null;
      const item = items.find(
        (candidate) =>
          !candidate.removed &&
          (selectedDocumentId === null
            ? candidate.documentId === null
            : candidate.documentId === selectedDocumentId),
      );
      if (item !== undefined) removeItem(item.itemId);
    },
    resources: () => dependencies.repository.stats(),
    processingSelection() {
      const runtime = selected();
      const item = items.find(
        (candidate) =>
          !candidate.removed &&
          (candidate.documentId === runtime?.documentId ||
            (runtime === null && candidate.preparing)),
      );
      if (item?.inferencePath === null || item === undefined) return null;
      return {
        effectiveMode: item.modelMode,
        fallbackUsed: item.modelMode !== item.requestedModelMode,
        inferencePath: item.inferencePath,
        requestedMode: item.requestedModelMode,
      };
    },
    currentModelMode() {
      const document = selected()?.actor.getSnapshot().context.document;
      return document?.committed?.automaticModelMode ?? null;
    },
    processingModelMode() {
      return (
        selected()?.actor.getSnapshot().context.document.activeRun?.modelMode ?? null
      );
    },
    singleExportSnapshot: () => singleExport,
    retry(modelMode) {
      const runtime = selected();
      if (runtime === null) return;
      runtime.actor.send({
        type: "COMMAND",
        command: {
          type: "START_AUTOMATIC_REMOVAL",
          documentId: runtime.documentId,
          backend: "local",
          modelMode: modelMode ?? "isnet-q8",
        },
      });
    },
    reprocess(modelMode) {
      const runtime = selected();
      if (runtime === null) return false;
      const item = items.find(
        (candidate) => !candidate.removed && candidate.documentId === runtime.documentId,
      );
      const document = runtime.actor.getSnapshot().context.document;
      if (
        item === undefined ||
        document.status !== "result" ||
        document.committed === null ||
        document.activeDraft !== null ||
        document.committed.automaticModelMode === modelMode ||
        !availableModelModes().includes(modelMode)
      )
        return false;
      runtime.actor.send({
        type: "COMMAND",
        command: {
          type: "START_AUTOMATIC_REMOVAL",
          documentId: runtime.documentId,
          backend: "local",
          modelMode,
        },
      });
      const outcome = runtime.actor.getSnapshot().context.lastCommandOutcome;
      if (outcome?.status !== "accepted") return false;
      item.requestedModelMode = modelMode;
      item.modelMode = modelMode;
      publish();
      return true;
    },
    async retryItem(itemId) {
      const item = items.find(
        (candidate) => candidate.itemId === itemId && !candidate.removed,
      );
      if (item === undefined) return;
      if (item.runtime !== null) {
        const document = item.runtime.actor.getSnapshot().context.document;
        if (document.status === "error") {
          item.runtime.actor.send({
            type: "COMMAND",
            command: {
              type: "START_AUTOMATIC_REMOVAL",
              documentId: document.documentId,
              backend: "local",
              modelMode: item.modelMode,
            },
          });
        }
        return;
      }
      item.error = null;
      item.preparing = true;
      publish();
      const result = await imports.prepare({ itemId, file: item.file });
      if (!result.ok) {
        item.preparing = false;
        if (result.error !== "cancelled") item.error = result.error;
      } else registerPrepared(item, result.value);
      publish();
    },
    retryEnhancements: () => selected()?.retryEnhancements(),
    selectBackgroundImage: (file) =>
      selected()?.selectBackgroundImage(file) ?? Promise.resolve(),
    selectDocument(documentId) {
      if (!runtimes.has(documentId)) return;
      workspace.send({ type: "SELECT_DOCUMENT", documentId });
      publish();
    },
    selectMagicCandidate: (id) => selected()?.selectMagicCandidate(id),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeActive(listener) {
      activeListeners.add(listener);
      return () => activeListeners.delete(listener);
    },
    undoDocument() {
      const runtime = selected();
      if (runtime === null) return;
      const revision = runtime.actor.getSnapshot().context.document.revision;
      runtime.actor.send({
        type: "COMMAND",
        command: {
          type: "UNDO_DOCUMENT",
          documentId: runtime.documentId,
          expectedRevision: revision,
        },
      });
    },
    undoMagic: () => selected()?.undoMagic(),
    undoManual: () => selected()?.undoManual(),
    workspaceSnapshot,
  };
}
