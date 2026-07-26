import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createEditDocumentScope,
  disposeEditDocumentScope,
  resolveEditDocumentImage,
  type EditDocumentScope,
} from "../../../entities/edit-document";
import type {
  AlphaMatte,
  BackgroundFill,
  ProcessedImage,
  QualityMode,
  RefinementConstraintMap,
} from "../../../entities/processed-image";
import { useBatchProcessing } from "../../../features/batch-processing";
import {
  commitProcessedImage,
  commitProcessedImageIfCurrent,
} from "../../../features/editor-history";
import {
  detectDeviceCapabilities,
  useBackgroundRemoval,
} from "../../../features/remove-background";
import { useQualityMode } from "../../../features/quality-mode-toggle";
import {
  createGuidedBrushConstraints,
  createGuidedBrushViewSession,
  useGuidedBrushSelection,
} from "../../../features/select-object";
import {
  recommendMattingMode,
  useMatteRefinement,
  type MattingRefinementMode,
} from "../../../features/refine-matte";
import { useForegroundRefinement } from "../../../features/refine-foreground";
import type { UploadResult, UploadValidationError } from "../../../features/upload-image";
import { sourceImageToFile } from "../lib/source-image-to-file";

export type WorkspaceDisplayError = {
  message: string;
  action: "retry" | "reset";
};

export type GuidedBrushVisualContext = {
  entryKind: "direct" | "processed";
  resultColorSource: Blob;
};

type GuidedTarget =
  | { kind: "direct" }
  | {
      kind: "single";
      image: ProcessedImage;
      documentRevision: number;
    }
  | {
      kind: "batch";
      itemId: string;
      image: ProcessedImage;
      documentRevision: number;
      workerOwnerId: string;
    };

type ResultTarget =
  | { kind: "single"; image: ProcessedImage; documentRevision: number }
  | {
      kind: "batch";
      itemId: string;
      image: ProcessedImage;
      documentRevision: number;
      workerOwnerId: string;
    };

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
  const [originalMatte, setOriginalMatte] = useState<AlphaMatte | null>(null);
  const [extractingMatte, setExtractingMatte] = useState(false);
  const [finalizingCorrection, setFinalizingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<WorkspaceDisplayError | null>(
    null,
  );
  const [correctionViewAnnouncement, setCorrectionViewAnnouncement] = useState("");
  const [previewFill, setPreviewFill] = useState<BackgroundFill>({
    type: "transparent",
  });
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [batchPreviewFills, setBatchPreviewFills] = useState<
    Record<string, BackgroundFill>
  >({});
  const [batchBackgroundBusy, setBatchBackgroundBusy] = useState<Record<string, boolean>>(
    {},
  );
  const [hydrated, setHydrated] = useState(false);
  const [guidedEntry, setGuidedEntry] = useState(false);
  const [guidedVisualContext, setGuidedVisualContext] =
    useState<GuidedBrushVisualContext | null>(null);
  const [refinementMode, setRefinementMode] = useState<MattingRefinementMode>("balanced");
  const [singleDocument, setSingleDocument] = useState<EditDocumentScope | null>(null);

  const singleDocumentRef = useRef<EditDocumentScope | null>(null);
  const retryCorrectionRef = useRef<(() => void) | null>(null);
  const correctionRunRef = useRef(0);
  const guidedRunRef = useRef(0);
  const guidedTargetRef = useRef<GuidedTarget | null>(null);
  const refinementContextRef = useRef<{
    guidedMatte: AlphaMatte | null;
    constraints: RefinementConstraintMap | null;
  }>({ guidedMatte: null, constraints: null });
  const refinementTargetRef = useRef<ResultTarget | null>(null);
  const appliedRefinementRef = useRef<AlphaMatte | null>(null);
  const foregroundTargetRef = useRef<ResultTarget | null>(null);
  const appliedForegroundRef = useRef<Blob | null>(null);

  const guided = useGuidedBrushSelection();
  const guidedViewSession = useMemo(
    () =>
      guided.state.session ? createGuidedBrushViewSession(guided.state.session) : null,
    [guided.state.session],
  );
  const refinement = useMatteRefinement();
  const finishRefinementApplying = refinement.finishApplying;
  const foregroundRefinement = useForegroundRefinement();
  const finishForegroundApplying = foregroundRefinement.finishApplying;
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

  useEffect(
    () => () => {
      correctionRunRef.current += 1;
      guidedRunRef.current += 1;
      disposeScope(singleDocumentRef.current);
      singleDocumentRef.current = null;
    },
    [],
  );

  async function releaseRefinementBeforeHeavyWork() {
    await Promise.all([refinement.release(), foregroundRefinement.release()]);
    refinement.reset();
    foregroundRefinement.reset();
    refinementTargetRef.current = null;
    appliedRefinementRef.current = null;
    foregroundTargetRef.current = null;
    appliedForegroundRef.current = null;
  }

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

  function handleUpload(result: UploadResult) {
    const guidedRunId = guidedRunRef.current + 1;
    guidedRunRef.current = guidedRunId;
    correctionRunRef.current += 1;
    setCorrectionError(null);
    setCorrectionViewAnnouncement("");
    retryCorrectionRef.current = null;
    setPreviewFill({ type: "transparent" });
    setBackgroundBusy(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    disposeScope(singleDocumentRef.current);
    publishSingleDocument(null);
    setUploadError(null);
    refinementContextRef.current = {
      guidedMatte: null,
      constraints: null,
    };
    void releaseRefinementBeforeHeavyWork().then(() => {
      if (guidedRunRef.current !== guidedRunId) return;
      if (guidedEntry) {
        guidedTargetRef.current = { kind: "direct" };
        setGuidedVisualContext({
          entryKind: "direct",
          resultColorSource: result.image.blob,
        });
        guided.start(result.image);
      } else {
        guidedTargetRef.current = null;
        setGuidedVisualContext(null);
        selectFile(sourceImageToFile(result.image));
      }
    });
  }

  function handleUploads(results: Array<{ fileName: string; result: UploadResult }>) {
    const valid = results.flatMap(({ fileName, result }) =>
      result.ok ? [{ fileName, source: result.image }] : [],
    );
    const invalid = results.find(({ result }) => !result.ok);
    setUploadError(invalid && !invalid.result.ok ? invalid.result.error : null);
    if (valid.length)
      void releaseRefinementBeforeHeavyWork().then(() => batch.enqueue(valid));
  }

  function handleReset() {
    correctionRunRef.current += 1;
    guidedRunRef.current += 1;
    disposeScope(singleDocumentRef.current);
    publishSingleDocument(null);
    setUploadError(null);
    setPreparingFileCount(0);
    setCorrectionError(null);
    setCorrectionViewAnnouncement("");
    retryCorrectionRef.current = null;
    setOriginalMatte(null);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    setPreviewFill({ type: "transparent" });
    setBackgroundBusy(false);
    setGuidedEntry(false);
    setGuidedVisualContext(null);
    guidedTargetRef.current = null;
    refinementContextRef.current = {
      guidedMatte: null,
      constraints: null,
    };
    refinementTargetRef.current = null;
    appliedRefinementRef.current = null;
    foregroundTargetRef.current = null;
    appliedForegroundRef.current = null;
    void refinement.release().then(refinement.reset);
    void foregroundRefinement.release().then(foregroundRefinement.reset);
    guided.reset();
    resetRemoval();
  }

  function handleAcceptGuided() {
    const session = guided.state.session;
    const target = guidedTargetRef.current;
    if (!session || !guided.state.matte || !target || !guided.canAccept) return;
    const seed =
      target.kind === "single" || target.kind === "batch"
        ? target.image
        : {
            source: session.source,
            result: session.source.blob,
            qualityMode: "isnet-q8" as const,
            alphaMatte: guided.state.matte,
            backgroundFill: { type: "transparent" as const },
          };
    const guidedRunId = guidedRunRef.current + 1;
    guidedRunRef.current = guidedRunId;
    retryCorrectionRef.current = () => {
      if (guidedTargetRef.current === target) handleAcceptGuided();
    };
    setCorrectionError(null);
    setFinalizingCorrection(true);
    const constraints = createGuidedBrushConstraints(session);
    const guidedMatte = guided.state.matte;
    const apply = target.kind === "batch" ? batch.recomposite : recomposite;
    void apply(seed, guided.state.matte)
      .then((result) => {
        if (guidedRunRef.current !== guidedRunId || guidedTargetRef.current !== target)
          return;
        const committed =
          target.kind === "batch"
            ? commitBatchResult(
                target.itemId,
                result,
                "cutout",
                "Cutout",
                target.documentRevision,
                target.workerOwnerId,
              )
            : target.kind === "single"
              ? commitSingleResult(result, "cutout", "Cutout", target.documentRevision)
              : commitSingleResult(result, "cutout", "Cutout");
        if (!committed) return;
        setFinalizingCorrection(false);
        refinementContextRef.current = {
          guidedMatte,
          constraints,
        };
        setOriginalMatte(null);
        guided.reset();
        guidedTargetRef.current = null;
        setGuidedVisualContext(null);
        setGuidedEntry(false);
        retryCorrectionRef.current = null;
      })
      .catch((error: unknown) => {
        if (guidedRunRef.current !== guidedRunId || guidedTargetRef.current !== target)
          return;
        setFinalizingCorrection(false);
        setCorrectionError({
          message: error instanceof Error ? error.message : String(error),
          action: "retry",
        });
      });
  }

  function handleGuideAutomaticResult() {
    if (state.status !== "result") return;
    const image = state.result;
    const guidedRunId = guidedRunRef.current + 1;
    guidedRunRef.current = guidedRunId;
    retryCorrectionRef.current = () => {
      if (state.status === "result") handleGuideAutomaticResult();
    };
    setCorrectionError(null);
    setExtractingMatte(true);
    void (async () => {
      try {
        await releaseRefinementBeforeHeavyWork();
        if (guidedRunRef.current !== guidedRunId) return;
        const matte = await extractMatte(image);
        if (guidedRunRef.current !== guidedRunId) return;
        let scope = singleDocumentRef.current;
        if (!scope) {
          scope = createEditDocumentScope(
            { ...image, alphaMatte: matte },
            { inferencePath: deviceCapabilities?.inferencePath ?? null },
          );
          publishSingleDocument(scope);
        }
        await releaseInference();
        if (guidedRunRef.current !== guidedRunId) return;
        setExtractingMatte(false);
        guidedTargetRef.current = {
          kind: "single",
          image,
          documentRevision: scope.document.revision,
        };
        setGuidedVisualContext({
          entryKind: "processed",
          resultColorSource: image.foreground ?? image.source.blob,
        });
        guided.start(image.source, matte);
        retryCorrectionRef.current = null;
      } catch (error: unknown) {
        if (guidedRunRef.current !== guidedRunId) return;
        setExtractingMatte(false);
        setCorrectionError({
          message: error instanceof Error ? error.message : String(error),
          action: "retry",
        });
      }
    })();
  }

  function handleGuideBatchResult() {
    if (!selectedBatchItem?.processedImage || !selectedBatchItem.editDocument) return;
    const { id, processedImage, editDocument } = selectedBatchItem;
    const guidedRunId = guidedRunRef.current + 1;
    guidedRunRef.current = guidedRunId;
    retryCorrectionRef.current = () => {
      if (
        selectedBatchItem?.id === id &&
        selectedBatchItem.processedImage === processedImage
      )
        handleGuideBatchResult();
    };
    setCorrectionError(null);
    setExtractingMatte(true);
    void (async () => {
      try {
        await Promise.all([
          releaseInference(),
          refinement.release().then(refinement.reset),
          foregroundRefinement.release().then(foregroundRefinement.reset),
          batch.releaseInference(),
        ]);
        if (guidedRunRef.current !== guidedRunId) return;
        const matte =
          processedImage.alphaMatte ?? (await batch.extractMatte(processedImage));
        if (guidedRunRef.current !== guidedRunId) return;
        setExtractingMatte(false);
        guidedTargetRef.current = {
          kind: "batch",
          itemId: id,
          image: processedImage,
          documentRevision: editDocument.document.revision,
          workerOwnerId: editDocument.workerOwnerId,
        };
        setGuidedVisualContext({
          entryKind: "processed",
          resultColorSource: processedImage.foreground ?? processedImage.source.blob,
        });
        guided.start(processedImage.source, matte);
        retryCorrectionRef.current = null;
      } catch (error: unknown) {
        if (guidedRunRef.current !== guidedRunId) return;
        setExtractingMatte(false);
        setCorrectionError({
          message: error instanceof Error ? error.message : String(error),
          action: "retry",
        });
      }
    })();
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

  function startSingleRefinement(image: ProcessedImage) {
    const previousTarget = refinementTargetRef.current;
    const seed =
      refinement.state.status === "result" && previousTarget?.kind === "single"
        ? previousTarget.image
        : image;
    if (!seed.alphaMatte) return;
    refinement.prepareNext();
    void Promise.all([
      releaseInference(),
      guided.release(),
      foregroundRefinement.release().then(foregroundRefinement.reset),
    ]).then(() => {
      const cleanSeed = { ...seed, foreground: undefined };
      refinementTargetRef.current = targetForSingle(cleanSeed);
      appliedRefinementRef.current = null;
      refinement.start({
        source: seed.source,
        priorMatte: seed.alphaMatte!,
        guidedMatte: refinementContextRef.current.guidedMatte,
        constraints: refinementContextRef.current.constraints,
        mode: refinementMode,
        path: deviceCapabilities?.inferencePath ?? "wasm",
      });
    });
  }

  function startBatchRefinement(itemId: string, image: ProcessedImage) {
    const previousTarget = refinementTargetRef.current;
    const seed =
      refinement.state.status === "result" &&
      previousTarget?.kind === "batch" &&
      previousTarget.itemId === itemId
        ? previousTarget.image
        : image;
    if (!seed.alphaMatte || batch.snapshot.activeCount || batch.snapshot.queuedCount)
      return;
    refinement.prepareNext();
    void Promise.all([
      releaseInference(),
      guided.release(),
      batch.releaseInference(),
      foregroundRefinement.release().then(foregroundRefinement.reset),
    ]).then(() => {
      const cleanSeed = { ...seed, foreground: undefined };
      refinementTargetRef.current = targetForBatch(itemId, cleanSeed);
      appliedRefinementRef.current = null;
      refinement.start({
        source: seed.source,
        priorMatte: seed.alphaMatte!,
        guidedMatte: refinementContextRef.current.guidedMatte,
        constraints: refinementContextRef.current.constraints,
        mode: refinementMode,
        path: deviceCapabilities?.inferencePath ?? "wasm",
      });
    });
  }

  useEffect(() => {
    const result = refinement.state.result;
    const target = refinementTargetRef.current;
    if (!result || !target || appliedRefinementRef.current === result.matte) return;
    appliedRefinementRef.current = result.matte;
    const apply = target.kind === "single" ? recomposite : batch.recomposite;
    void apply(target.image, result.matte)
      .then((updated) => {
        if (refinementTargetRef.current !== target) return;
        const committed =
          target.kind === "single"
            ? commitSingleResult(updated, "enhance", "Enhance", target.documentRevision)
            : commitBatchResult(
                target.itemId,
                updated,
                "enhance",
                "Enhance",
                target.documentRevision,
                target.workerOwnerId,
              );
        if (committed) finishRefinementApplying();
      })
      .catch((error: unknown) => {
        finishRefinementApplying();
        setCorrectionError({
          message: `Could not apply refined matte: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }, [
    batch,
    commitBatchResult,
    commitSingleResult,
    finishRefinementApplying,
    recomposite,
    refinement.state.result,
  ]);

  function startSingleForegroundRefinement(
    image: ProcessedImage,
    componentCleanup: boolean,
  ) {
    if (!image.alphaMatte) return;
    foregroundRefinement.prepareNext();
    void Promise.all([
      releaseInference(),
      guided.release(),
      refinement.release().then(refinement.reset),
    ]).then(() => {
      const seed = { ...image, foreground: undefined };
      foregroundTargetRef.current = targetForSingle(seed);
      appliedForegroundRef.current = null;
      foregroundRefinement.start({
        source: seed.source,
        matte: image.alphaMatte!,
        constraints: refinementContextRef.current.constraints,
        componentCleanup,
      });
    });
  }

  function startBatchForegroundRefinement(
    itemId: string,
    image: ProcessedImage,
    componentCleanup: boolean,
  ) {
    if (!image.alphaMatte || batch.snapshot.activeCount || batch.snapshot.queuedCount)
      return;
    foregroundRefinement.prepareNext();
    void Promise.all([
      releaseInference(),
      guided.release(),
      refinement.release().then(refinement.reset),
      batch.releaseInference(),
    ]).then(() => {
      const seed = { ...image, foreground: undefined };
      foregroundTargetRef.current = targetForBatch(itemId, seed);
      appliedForegroundRef.current = null;
      foregroundRefinement.start({
        source: seed.source,
        matte: image.alphaMatte!,
        constraints: refinementContextRef.current.constraints,
        componentCleanup,
      });
    });
  }

  useEffect(() => {
    const result = foregroundRefinement.state.result;
    const target = foregroundTargetRef.current;
    if (!result || !target || appliedForegroundRef.current === result.foreground) return;
    appliedForegroundRef.current = result.foreground;
    const apply = target.kind === "single" ? recomposite : batch.recomposite;
    const image = { ...target.image, foreground: result.foreground };
    void apply(image, result.matte)
      .then((updated) => {
        if (foregroundTargetRef.current !== target) return;
        const committed =
          target.kind === "single"
            ? commitSingleResult(updated, "enhance", "Enhance", target.documentRevision)
            : commitBatchResult(
                target.itemId,
                updated,
                "enhance",
                "Enhance",
                target.documentRevision,
                target.workerOwnerId,
              );
        if (committed) finishForegroundApplying();
      })
      .catch((error: unknown) => {
        finishForegroundApplying();
        setCorrectionError({
          message: `Could not apply foreground cleanup: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }, [
    batch,
    commitBatchResult,
    commitSingleResult,
    finishForegroundApplying,
    foregroundRefinement.state.result,
    recomposite,
  ]);

  function handleRetry() {
    if (correctionError && retryCorrectionRef.current) {
      retryCorrectionRef.current();
      return;
    }
    retry();
  }

  function handleEditMask() {
    if (state.status !== "result") return;
    const image = state.result;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    retryCorrectionRef.current = () => {
      if (state.status === "result") handleEditMask();
    };
    setCorrectionError(null);
    setExtractingMatte(true);
    void extractMatte(image)
      .then((matte) => {
        if (correctionRunRef.current !== runId) return;
        let scope = singleDocumentRef.current;
        if (!scope) {
          scope = createEditDocumentScope(
            { ...image, alphaMatte: matte },
            { inferencePath: deviceCapabilities?.inferencePath ?? null },
          );
          publishSingleDocument(scope);
        }
        setExtractingMatte(false);
        setOriginalMatte(matte);
        retryCorrectionRef.current = null;
        refinementTargetRef.current = {
          kind: "single",
          image,
          documentRevision: scope.document.revision,
        };
        enterCorrecting();
      })
      .catch((error: unknown) => {
        if (correctionRunRef.current !== runId) return;
        setExtractingMatte(false);
        setCorrectionError({
          message: `Could not prepare mask editor: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  function handleBatchEditMask() {
    if (!selectedBatchItem?.processedImage || !selectedBatchItem.editDocument) return;
    const image = selectedBatchItem.processedImage;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    setExtractingMatte(true);
    refinementTargetRef.current = {
      kind: "batch",
      itemId: selectedBatchItem.id,
      image,
      documentRevision: selectedBatchItem.editDocument.document.revision,
      workerOwnerId: selectedBatchItem.editDocument.workerOwnerId,
    };
    void batch
      .extractMatte(image)
      .then((matte) => {
        if (correctionRunRef.current !== runId) return;
        setExtractingMatte(false);
        setOriginalMatte(matte);
      })
      .catch((error: unknown) => {
        if (correctionRunRef.current !== runId) return;
        setExtractingMatte(false);
        setCorrectionError({
          message: `Could not prepare mask editor: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  function handleSelectBatchItem(id: string) {
    if (id !== batch.session.selectedItemId) {
      correctionRunRef.current += 1;
      guidedRunRef.current += 1;
      setCorrectionError(null);
      setExtractingMatte(false);
      setOriginalMatte(null);
      setCorrectionViewAnnouncement("");
      refinement.cancel();
      refinementTargetRef.current = null;
      foregroundRefinement.cancel();
      foregroundTargetRef.current = null;
      refinementContextRef.current = {
        guidedMatte: null,
        constraints: null,
      };
      guidedTargetRef.current = null;
      setGuidedVisualContext(null);
      guided.reset();
      setFinalizingCorrection(false);
      retryCorrectionRef.current = null;
    }
    batch.selectItem(id);
  }

  function handleClearBatch() {
    correctionRunRef.current += 1;
    guidedRunRef.current += 1;
    retryCorrectionRef.current = null;
    setCorrectionError(null);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    guided.reset();
    guidedTargetRef.current = null;
    setGuidedVisualContext(null);
    setGuidedEntry(false);
    refinementContextRef.current = {
      guidedMatte: null,
      constraints: null,
    };
    void Promise.all([
      refinement.release().then(refinement.reset),
      foregroundRefinement.release().then(foregroundRefinement.reset),
    ]);
    batch.reset();
  }

  function handleBatchDoneCorrecting(correctedMatte: AlphaMatte) {
    const target = refinementTargetRef.current;
    if (
      !selectedBatchItem?.processedImage ||
      !target ||
      target.kind !== "batch" ||
      target.itemId !== selectedBatchItem.id
    )
      return;
    const image = selectedBatchItem.processedImage;
    setFinalizingCorrection(true);
    void batch
      .recomposite(image, correctedMatte)
      .then((updated) => {
        if (refinementTargetRef.current !== target) return;
        setFinalizingCorrection(false);
        setOriginalMatte(null);
        commitBatchResult(
          target.itemId,
          updated,
          "manual",
          "Manual",
          target.documentRevision,
          target.workerOwnerId,
        );
      })
      .catch((error: unknown) => {
        setFinalizingCorrection(false);
        setCorrectionError({
          message: `Could not apply mask correction: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  function handleDoneCorrecting(correctedMatte: AlphaMatte) {
    if (state.status !== "correcting") return;
    const target = refinementTargetRef.current;
    if (!target || target.kind !== "single") return;
    const image = state.result;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    retryCorrectionRef.current = () => {
      if (state.status === "correcting") handleDoneCorrecting(correctedMatte);
    };
    setCorrectionError(null);
    setFinalizingCorrection(true);
    void recomposite(image, correctedMatte)
      .then((updated) => {
        if (correctionRunRef.current !== runId || refinementTargetRef.current !== target)
          return;
        if (!commitSingleResult(updated, "manual", "Manual", target.documentRevision))
          return;
        setFinalizingCorrection(false);
        setOriginalMatte(null);
        retryCorrectionRef.current = null;
        exitCorrecting(updated);
      })
      .catch((error: unknown) => {
        if (correctionRunRef.current !== runId) return;
        setFinalizingCorrection(false);
        setCorrectionError({
          message: `Could not apply mask correction: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  function commitSingleBackground(updated: ProcessedImage) {
    commitSingleResult(updated, "background", "Background");
  }

  function commitBatchBackground(itemId: string, updated: ProcessedImage) {
    commitBatchResult(itemId, updated, "background", "Background");
  }

  function cancelGuided() {
    guidedRunRef.current += 1;
    guided.reset();
    guidedTargetRef.current = null;
    setGuidedVisualContext(null);
    setGuidedEntry(false);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    setCorrectionError(null);
    retryCorrectionRef.current = null;
  }

  return {
    uploadError,
    preparingFileCount,
    setPreparingFileCount,
    originalMatte,
    extractingMatte,
    finalizingCorrection,
    correctionError,
    correctionViewAnnouncement,
    setCorrectionViewAnnouncement,
    previewFill,
    setPreviewFill,
    backgroundBusy,
    setBackgroundBusy,
    batchPreviewFills,
    setBatchPreviewFills,
    batchBackgroundBusy,
    setBatchBackgroundBusy,
    hydrated,
    guidedEntry,
    setGuidedEntry,
    guidedVisualContext,
    guided,
    guidedViewSession,
    refinement,
    foregroundRefinement,
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
    releaseRefinementBeforeHeavyWork,
    batch,
    batchModelKey,
    selectedBatchItem,
    lastLogMessage,
    handleUpload,
    handleUploads,
    handleReset,
    handleAcceptGuided,
    handleGuideAutomaticResult,
    handleGuideBatchResult,
    startSingleRefinement,
    startBatchRefinement,
    startSingleForegroundRefinement,
    startBatchForegroundRefinement,
    handleRetry,
    handleEditMask,
    handleBatchEditMask,
    handleSelectBatchItem,
    handleClearBatch,
    handleBatchDoneCorrecting,
    handleDoneCorrecting,
    commitSingleBackground,
    commitBatchBackground,
    cancelGuided,
  };
}

export type UseToolWorkspaceControllerResult = ReturnType<
  typeof useToolWorkspaceController
>;
