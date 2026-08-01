import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createEditDocumentScope,
  disposeEditDocumentScope,
  resolveEditDocumentImage,
  type EditDocumentScope,
} from "../../../entities/edit-document";
import type {
  BackgroundFill,
  ProcessedImage,
  QualityMode,
} from "../../../entities/processed-image";
import { useBatchProcessing } from "../../../features/batch-processing";
import {
  commitProcessedImage,
  commitProcessedImageIfCurrent,
  redoEdit,
  selectEditHistory,
  undoEdit,
} from "../../../features/editor-history";
import {
  detectDeviceCapabilities,
  useBackgroundRemoval,
} from "../../../features/remove-background";
import { useQualityMode } from "../../../features/quality-mode-toggle";
import {
  createGuidedBrushViewSession,
  useGuidedBrushSelection,
} from "../../../features/select-object";
import {
  recommendMattingMode,
  type MattingRefinementMode,
} from "../../../features/refine-matte";
import type { UploadResult, UploadValidationError } from "../../../features/upload-image";
import { sourceImageToFile } from "../lib/source-image-to-file";
import type { EnhancementOperationId } from "./enhancement-operation-registry";
import { useEnhancementRunner, type ResultTarget } from "./use-enhancement-runner";
import { useGuidedCutout, type WorkspaceDisplayError } from "./use-guided-cutout";
import { useMaskCorrectionFlow } from "./use-mask-correction-flow";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

export type { EnhancementControllerState } from "./use-enhancement-runner";
export type {
  WorkspaceDisplayError,
  GuidedBrushVisualContext,
} from "./use-guided-cutout";

function disposeScope(scope: EditDocumentScope | null): void {
  if (scope) disposeEditDocumentScope(scope);
}

/**
 * Owns the editor's asynchronous orchestration and browser-memory document
 * lifecycle. The UI component consumes this typed surface and only renders or
 * forwards user intent.
 */
export function useToolWorkspaceController() {
  const [defaultQualityMode, setDefaultQualityMode] = useState<QualityMode>("fast");
  const [uploadError, setUploadError] = useState<UploadValidationError | null>(null);
  const [preparingFileCount, setPreparingFileCount] = useState(0);
  const [extractingMatte, setExtractingMatte] = useState(false);
  const [finalizingCorrection, setFinalizingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<WorkspaceDisplayError | null>(
    null,
  );
  const [canvasDecodeRetryToken, setCanvasDecodeRetryToken] = useState(0);
  const [correctionViewAnnouncement, setCorrectionViewAnnouncement] = useState("");
  const [previewFill, setPreviewFill] = useState<BackgroundFill>({
    type: "transparent",
  });
  const [batchPreviewFills, setBatchPreviewFills] = useState<
    Record<string, BackgroundFill>
  >({});
  const [hydrated, setHydrated] = useState(false);
  const [refinementMode, setRefinementMode] = useState<MattingRefinementMode>("balanced");
  const [singleDocument, setSingleDocument] = useState<EditDocumentScope | null>(null);

  const singleDocumentRef = useRef<EditDocumentScope | null>(null);
  const retryCorrectionRef = useRef<(() => void) | null>(null);

  const guided = useGuidedBrushSelection();
  const guidedViewSession = useMemo(
    () =>
      guided.state.session ? createGuidedBrushViewSession(guided.state.session) : null,
    [guided.state.session],
  );
  const { qualityMode, setQualityMode } = useQualityMode(defaultQualityMode);
  const removal = useBackgroundRemoval(qualityMode);
  const {
    state,
    deviceCapabilities,
    lightweightMode,
    runInfo,
    logs,
    modelLoadBytes,
    ben2FallbackNotice,
    selectFile,
    recomputeMaxQuality,
    retry,
    retryInLightweightMode,
    reset: resetRemoval,
    enterCorrecting,
    exitCorrecting,
    extractMatte,
    recomposite,
    applyBackgroundFill,
    replaceResult,
    adoptResult,
    releaseInference,
  } = removal;
  const batch = useBatchProcessing({
    qualityMode,
    inferencePath: deviceCapabilities?.inferencePath ?? "wasm",
    concurrencyLimit:
      qualityMode === "ben2-fp16"
        ? 1
        : deviceCapabilities?.inferencePath === "webgpu"
          ? 2
          : 1,
  });
  const batchItems = batch.session.items;
  const replaceBatchResult = batch.replaceResult;
  const selectedBatchItem = batch.session.items.find(
    (item) => item.id === batch.session.selectedItemId,
  );
  const activeEditDocument = selectedBatchItem?.editDocument ?? singleDocument;
  const historySelectors = useMemo(
    () =>
      activeEditDocument
        ? selectEditHistory(
            activeEditDocument.history,
            getLocale() === "ru" ? "ru" : "en",
          )
        : {
            canUndo: false,
            canRedo: false,
            undoLabel: null,
            redoLabel: null,
          },
    [activeEditDocument],
  );
  const batchModelKey =
    `${qualityMode}:${deviceCapabilities?.inferencePath ?? "wasm"}` as const;
  const lastLogMessage = logs.at(-1)?.message;

  const publishSingleDocument = useCallback((scope: EditDocumentScope | null) => {
    singleDocumentRef.current = scope;
    setSingleDocument(scope);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration is an external browser lifecycle signal.
    setHydrated(true);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void detectDeviceCapabilities().then((capabilities) => {
      if (!cancelled) {
        setDefaultQualityMode(capabilities.defaultQualityMode);
        setRefinementMode(recommendMattingMode(capabilities.inferencePath));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "result") return;
    if (!state.result.alphaMatte) return;
    const current = singleDocumentRef.current;
    if (current?.artifacts.idOf(state.result.result)) return;
    disposeScope(current);
    const scope = createEditDocumentScope(state.result, {
      inferencePath: deviceCapabilities?.inferencePath ?? null,
    });
    publishSingleDocument(scope);
  }, [deviceCapabilities?.inferencePath, publishSingleDocument, state]);

  const commitSingleResult = useCallback(
    (
      image: ProcessedImage,
      kind: "cutout" | "manual" | "enhance" | "background",
      label: string,
      expectedRevision?: number,
    ): boolean => {
      const current = singleDocumentRef.current;
      if (!current) {
        if (!image.alphaMatte) return false;
        const scope = createEditDocumentScope(image, {
          inferencePath: deviceCapabilities?.inferencePath ?? null,
        });
        publishSingleDocument(scope);
        adoptResult(image);
        return true;
      }
      const completeImage = image.alphaMatte
        ? image
        : {
            ...image,
            alphaMatte: resolveEditDocumentImage(current).alphaMatte,
          };
      const next =
        expectedRevision === undefined
          ? commitProcessedImage(current, completeImage, { kind, label })
          : commitProcessedImageIfCurrent(current, expectedRevision, completeImage, {
              kind,
              label,
            });
      if (next === current && expectedRevision !== undefined) return false;
      publishSingleDocument(next);
      replaceResult(completeImage);
      return true;
    },
    [
      adoptResult,
      deviceCapabilities?.inferencePath,
      publishSingleDocument,
      replaceResult,
    ],
  );

  const commitBatchResult = useCallback(
    (
      itemId: string,
      image: ProcessedImage,
      kind: "cutout" | "manual" | "enhance" | "background",
      label: string,
      expectedRevision?: number,
      workerOwnerId?: string,
    ): boolean => {
      const item = batchItems.find((candidate) => candidate.id === itemId);
      const current = item?.editDocument;
      if (!item || !current) return false;
      if (workerOwnerId && current.workerOwnerId !== workerOwnerId) return false;
      const completeImage = image.alphaMatte
        ? image
        : {
            ...image,
            alphaMatte: resolveEditDocumentImage(current).alphaMatte,
          };
      const next =
        expectedRevision === undefined
          ? commitProcessedImage(current, completeImage, { kind, label })
          : commitProcessedImageIfCurrent(current, expectedRevision, completeImage, {
              kind,
              label,
            });
      if (next === current && expectedRevision !== undefined) return false;
      replaceBatchResult(itemId, completeImage, next);
      return true;
    },
    [batchItems, replaceBatchResult],
  );

  const enhancementRunner = useEnhancementRunner({
    recompositeSingle: recomposite,
    recompositeBatch: batch.recomposite,
    releaseInference,
    guidedRelease: guided.release,
    batchReleaseInference: batch.releaseInference,
    refinementMode,
    inferencePath: deviceCapabilities?.inferencePath,
    commitSingleResult,
    commitBatchResult,
  });

  const guidedCutout = useGuidedCutout({
    guided,
    singleDocumentRef,
    publishSingleDocument,
    selectedBatchItem,
    removalState: state,
    inferencePath: deviceCapabilities?.inferencePath,
    extractMatte,
    batchExtractMatte: batch.extractMatte,
    releaseInference,
    recompositeSingle: recomposite,
    recompositeBatch: batch.recomposite,
    commitSingleResult,
    commitBatchResult,
    releaseRefinementBeforeHeavyWork: enhancementRunner.releaseBeforeHeavyWork,
    refinementRelease: enhancementRunner.refinement.release,
    refinementReset: enhancementRunner.refinement.reset,
    foregroundRefinementRelease: enhancementRunner.foregroundRefinement.release,
    foregroundRefinementReset: enhancementRunner.foregroundRefinement.reset,
    batchReleaseInference: batch.releaseInference,
    refinementContextRef: enhancementRunner.refinementContextRef,
    retryCorrectionRef,
    setCorrectionError,
    setExtractingMatte,
    setFinalizingCorrection,
  });

  const maskCorrection = useMaskCorrectionFlow({
    singleDocumentRef,
    publishSingleDocument,
    selectedBatchItem,
    removalState: state,
    inferencePath: deviceCapabilities?.inferencePath,
    extractMatte,
    batchExtractMatte: batch.extractMatte,
    recompositeSingle: recomposite,
    recompositeBatch: batch.recomposite,
    commitSingleResult,
    commitBatchResult,
    enterCorrecting,
    exitCorrecting,
    refinementTargetRef: enhancementRunner.refinementTargetRef,
    retryCorrectionRef,
    setCorrectionError,
    setExtractingMatte,
    setFinalizingCorrection,
  });

  useEffect(
    () => () => {
      maskCorrection.bumpCorrectionRun();
      guidedCutout.bumpGuidedRun();
      disposeScope(singleDocumentRef.current);
      singleDocumentRef.current = null;
    },
    // guidedCutout/maskCorrection are fresh object literals every render, so
    // depending on either whole object would fire this unmount-only cleanup
    // on every render instead. The two "bump" functions are individually
    // stabilized with useCallback([]) precisely so this stays safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guidedCutout.bumpGuidedRun, maskCorrection.bumpCorrectionRun],
  );

  function handleUpload(result: UploadResult) {
    const guidedRunId = guidedCutout.bumpGuidedRun();
    maskCorrection.bumpCorrectionRun();
    setCorrectionError(null);
    setCorrectionViewAnnouncement("");
    retryCorrectionRef.current = null;
    setPreviewFill({ type: "transparent" });
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    disposeScope(singleDocumentRef.current);
    publishSingleDocument(null);
    setUploadError(null);
    enhancementRunner.setRefinementContext({
      guidedMatte: null,
      constraints: null,
    });
    void enhancementRunner.releaseBeforeHeavyWork().then(() => {
      if (guidedCutout.guidedRunRef.current !== guidedRunId) return;
      if (guidedCutout.guidedEntry) {
        guidedCutout.setGuidedTarget({ kind: "direct" });
        guidedCutout.setGuidedVisualContext({
          entryKind: "direct",
          resultColorSource: result.image.blob,
        });
        guided.start(result.image);
      } else {
        guidedCutout.setGuidedTarget(null);
        guidedCutout.setGuidedVisualContext(null);
        selectFile(sourceImageToFile(result.image));
      }
    });
  }

  function handleUploads(results: Array<{ fileName: string; result: UploadResult }>) {
    const invalid = results.find(({ result }) => !result.ok);
    setUploadError(invalid && !invalid.result.ok ? invalid.result.error : null);
    const valid = results.flatMap(({ fileName, result }) =>
      result.ok ? [{ fileName, source: result.image }] : [],
    );
    if (valid.length)
      void enhancementRunner.releaseBeforeHeavyWork().then(() => batch.enqueue(valid));
  }

  function handleDismissUploadError() {
    setUploadError(null);
  }

  function handleReset() {
    enhancementRunner.cancel();
    maskCorrection.bumpCorrectionRun();
    guidedCutout.bumpGuidedRun();
    disposeScope(singleDocumentRef.current);
    publishSingleDocument(null);
    setUploadError(null);
    setPreparingFileCount(0);
    setCorrectionError(null);
    setCorrectionViewAnnouncement("");
    retryCorrectionRef.current = null;
    maskCorrection.setOriginalMatte(null);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    setPreviewFill({ type: "transparent" });
    guidedCutout.setGuidedEntry(false);
    guidedCutout.setGuidedVisualContext(null);
    guidedCutout.setGuidedTarget(null);
    enhancementRunner.setRefinementContext({
      guidedMatte: null,
      constraints: null,
    });
    enhancementRunner.hardResetTargets();
    void enhancementRunner.refinement.release().then(enhancementRunner.refinement.reset);
    void enhancementRunner.foregroundRefinement
      .release()
      .then(enhancementRunner.foregroundRefinement.reset);
    guided.reset();
    resetRemoval();
  }

  function targetForSingle(image: ProcessedImage): ResultTarget | null {
    const scope = singleDocumentRef.current;
    return scope
      ? {
          kind: "single",
          image,
          documentRevision: scope.document.revision,
        }
      : null;
  }

  function targetForBatch(itemId: string, image: ProcessedImage): ResultTarget | null {
    const item = batch.session.items.find((candidate) => candidate.id === itemId);
    return item?.editDocument
      ? {
          kind: "batch",
          itemId,
          image,
          documentRevision: item.editDocument.document.revision,
          workerOwnerId: item.editDocument.workerOwnerId,
        }
      : null;
  }

  function applySingleEnhancements(
    image: ProcessedImage,
    operationIds: readonly EnhancementOperationId[],
    historyLabel: string,
  ) {
    const target = targetForSingle(image);
    const documentId = singleDocumentRef.current?.document.id;
    if (target && documentId)
      enhancementRunner.run({ target, operationIds, historyLabel, documentId });
  }

  function applyBatchEnhancements(
    itemId: string,
    image: ProcessedImage,
    operationIds: readonly EnhancementOperationId[],
    historyLabel: string,
  ) {
    if (batch.snapshot.activeCount || batch.snapshot.queuedCount) return;
    const target = targetForBatch(itemId, image);
    const documentId = batch.session.items.find((item) => item.id === itemId)
      ?.editDocument?.document.id;
    if (target && documentId)
      enhancementRunner.run({ target, operationIds, historyLabel, documentId });
  }

  function handleRetry() {
    if (correctionError && retryCorrectionRef.current) {
      retryCorrectionRef.current();
      return;
    }
    retry();
  }

  const handleCanvasDecodeError = useCallback(() => {
    setCorrectionError({ message: m.cutoutCanvasDecodeError(), action: "retry" });
    retryCorrectionRef.current = () => {
      setCorrectionError(null);
      setCanvasDecodeRetryToken((current) => current + 1);
    };
  }, []);

  function handleSelectBatchItem(id: string) {
    if (id !== batch.session.selectedItemId) {
      enhancementRunner.cancel();
      maskCorrection.bumpCorrectionRun();
      guidedCutout.bumpGuidedRun();
      setCorrectionError(null);
      setExtractingMatte(false);
      maskCorrection.setOriginalMatte(null);
      setCorrectionViewAnnouncement("");
      enhancementRunner.refinement.cancel();
      enhancementRunner.setRefinementTarget(null);
      enhancementRunner.foregroundRefinement.cancel();
      enhancementRunner.setForegroundTarget(null);
      enhancementRunner.setRefinementContext({
        guidedMatte: null,
        constraints: null,
      });
      guidedCutout.setGuidedTarget(null);
      guidedCutout.setGuidedVisualContext(null);
      guided.reset();
      setFinalizingCorrection(false);
      retryCorrectionRef.current = null;
    }
    batch.selectItem(id);
  }

  function handleClearBatch() {
    enhancementRunner.cancel();
    maskCorrection.bumpCorrectionRun();
    guidedCutout.bumpGuidedRun();
    retryCorrectionRef.current = null;
    setCorrectionError(null);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    guided.reset();
    guidedCutout.setGuidedTarget(null);
    guidedCutout.setGuidedVisualContext(null);
    guidedCutout.setGuidedEntry(false);
    enhancementRunner.setRefinementContext({
      guidedMatte: null,
      constraints: null,
    });
    void Promise.all([
      enhancementRunner.refinement.release().then(enhancementRunner.refinement.reset),
      enhancementRunner.foregroundRefinement
        .release()
        .then(enhancementRunner.foregroundRefinement.reset),
    ]);
    batch.reset();
  }

  function applySingleHistory(direction: "undo" | "redo") {
    const current = singleDocumentRef.current;
    if (!current) return;
    const next = direction === "undo" ? undoEdit(current) : redoEdit(current);
    if (next === current) return;
    const image = resolveEditDocumentImage(next);
    publishSingleDocument(next);
    replaceResult(image);
    setPreviewFill(image.backgroundFill ?? { type: "transparent" });
    if (guidedCutout.guidedTargetRef.current?.kind === "single") {
      guidedCutout.setGuidedTarget({
        ...guidedCutout.guidedTargetRef.current,
        image,
        documentRevision: next.document.revision,
      });
      guidedCutout.setGuidedVisualContext({
        entryKind: "processed",
        resultColorSource: image.foreground ?? image.source.blob,
      });
      guided.replaceBase(image.alphaMatte ?? null);
    }
  }

  function applyBatchHistory(direction: "undo" | "redo") {
    const item = selectedBatchItem;
    if (!item?.editDocument) return;
    const next =
      direction === "undo" ? undoEdit(item.editDocument) : redoEdit(item.editDocument);
    if (next === item.editDocument) return;
    const image = resolveEditDocumentImage(next);
    replaceBatchResult(item.id, image, next);
    setBatchPreviewFills((current) => ({
      ...current,
      [item.id]: image.backgroundFill ?? { type: "transparent" },
    }));
    if (
      guidedCutout.guidedTargetRef.current?.kind === "batch" &&
      guidedCutout.guidedTargetRef.current.itemId === item.id
    ) {
      guidedCutout.setGuidedTarget({
        ...guidedCutout.guidedTargetRef.current,
        image,
        documentRevision: next.document.revision,
      });
      guidedCutout.setGuidedVisualContext({
        entryKind: "processed",
        resultColorSource: image.foreground ?? image.source.blob,
      });
      guided.replaceBase(image.alphaMatte ?? null);
    }
  }

  function handleUndoDocument() {
    if (selectedBatchItem) applyBatchHistory("undo");
    else applySingleHistory("undo");
  }

  function handleRedoDocument() {
    if (selectedBatchItem) applyBatchHistory("redo");
    else applySingleHistory("redo");
  }

  function commitSingleBackground(updated: ProcessedImage) {
    commitSingleResult(updated, "background", m.editorHistoryBackground());
  }

  function commitBatchBackground(itemId: string, updated: ProcessedImage) {
    commitBatchResult(itemId, updated, "background", m.editorHistoryBackground());
  }

  return {
    uploadError,
    preparingFileCount,
    setPreparingFileCount,
    originalMatte: maskCorrection.originalMatte,
    extractingMatte,
    finalizingCorrection,
    correctionError,
    canvasDecodeRetryToken,
    handleCanvasDecodeError,
    correctionViewAnnouncement,
    setCorrectionViewAnnouncement,
    previewFill,
    setPreviewFill,
    batchPreviewFills,
    setBatchPreviewFills,
    hydrated,
    guidedEntry: guidedCutout.guidedEntry,
    setGuidedEntry: guidedCutout.setGuidedEntry,
    guidedVisualContext: guidedCutout.guidedVisualContext,
    guided,
    guidedViewSession,
    refinement: enhancementRunner.refinement,
    foregroundRefinement: enhancementRunner.foregroundRefinement,
    enhancementState: enhancementRunner.state,
    enhancementProgress: enhancementRunner.progress,
    refinementMode,
    setRefinementMode,
    singleDocument,
    qualityMode,
    setQualityMode,
    state,
    deviceCapabilities,
    lightweightMode,
    runInfo,
    logs,
    modelLoadBytes,
    ben2FallbackNotice,
    recomputeMaxQuality,
    retry,
    retryInLightweightMode,
    applyBackgroundFill,
    releaseRefinementBeforeHeavyWork: enhancementRunner.releaseBeforeHeavyWork,
    batch,
    batchModelKey,
    selectedBatchItem,
    activeEditDocument,
    historySelectors,
    lastLogMessage,
    handleUpload,
    handleUploads,
    handleDismissUploadError,
    handleReset,
    handleApplyGuided: guidedCutout.handleApplyGuided,
    handleGuideAutomaticResult: guidedCutout.handleGuideAutomaticResult,
    handleGuideBatchResult: guidedCutout.handleGuideBatchResult,
    synchronizeSingleGuidedTarget: guidedCutout.synchronizeSingleGuidedTarget,
    synchronizeBatchGuidedTarget: guidedCutout.synchronizeBatchGuidedTarget,
    applySingleEnhancements,
    applyBatchEnhancements,
    cancelEnhancements: enhancementRunner.cancel,
    retryEnhancements: enhancementRunner.retry,
    handleRetry,
    handleEditMask: maskCorrection.handleEditMask,
    handleBatchEditMask: maskCorrection.handleBatchEditMask,
    handleSelectBatchItem,
    handleClearBatch,
    handleBatchDoneCorrecting: maskCorrection.handleBatchDoneCorrecting,
    handleDoneCorrecting: maskCorrection.handleDoneCorrecting,
    handleCancelCorrection: maskCorrection.handleCancelCorrection,
    handleUndoDocument,
    handleRedoDocument,
    commitSingleBackground,
    commitBatchBackground,
    cancelGuided: guidedCutout.cancelGuided,
  };
}

export type UseToolWorkspaceControllerResult = ReturnType<
  typeof useToolWorkspaceController
>;
