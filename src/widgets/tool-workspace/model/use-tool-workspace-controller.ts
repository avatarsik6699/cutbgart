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
import type { EnhancementOperationId } from "./enhancement-operation-registry";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

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

export interface EnhancementControllerState {
  status: "idle" | "applying" | "error";
  activeOperationId: EnhancementOperationId | null;
  outcome: "applied" | "unchanged" | "kept-current" | null;
  errorCode: "out-of-memory" | "failed" | null;
  documentId: string | null;
}

interface EnhancementRun {
  id: number;
  target: ResultTarget;
  operationIds: readonly EnhancementOperationId[];
  operationIndex: number;
  image: ProcessedImage;
  changed: boolean;
  historyLabel: string;
  documentId: string;
}

interface EnhancementRequest {
  target: ResultTarget;
  operationIds: readonly EnhancementOperationId[];
  historyLabel: string;
  documentId: string;
}

const initialEnhancementState: EnhancementControllerState = {
  status: "idle",
  activeOperationId: null,
  outcome: null,
  errorCode: null,
  documentId: null,
};

function sameAlphaMatte(left: AlphaMatte, right: AlphaMatte): boolean {
  if (
    left.width !== right.width ||
    left.height !== right.height ||
    left.data.length !== right.data.length
  )
    return false;
  return left.data.every((value, index) => value === right.data[index]);
}

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
  const [batchPreviewFills, setBatchPreviewFills] = useState<
    Record<string, BackgroundFill>
  >({});
  const [hydrated, setHydrated] = useState(false);
  const [guidedEntry, setGuidedEntry] = useState(false);
  const [guidedVisualContext, setGuidedVisualContext] =
    useState<GuidedBrushVisualContext | null>(null);
  const [refinementMode, setRefinementMode] = useState<MattingRefinementMode>("balanced");
  const [singleDocument, setSingleDocument] = useState<EditDocumentScope | null>(null);
  const [enhancementState, setEnhancementState] = useState<EnhancementControllerState>(
    initialEnhancementState,
  );

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
  const enhancementSequenceRef = useRef(0);
  const enhancementRunRef = useRef<EnhancementRun | null>(null);
  const enhancementRequestRef = useRef<EnhancementRequest | null>(null);

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

  useEffect(
    () => () => {
      correctionRunRef.current += 1;
      guidedRunRef.current += 1;
      enhancementSequenceRef.current += 1;
      disposeScope(singleDocumentRef.current);
      singleDocumentRef.current = null;
    },
    [],
  );

  async function releaseRefinementBeforeHeavyWork() {
    enhancementSequenceRef.current += 1;
    enhancementRunRef.current = null;
    enhancementRequestRef.current = null;
    setEnhancementState(initialEnhancementState);
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
    cancelEnhancements();
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

  async function handleApplyGuided(): Promise<boolean> {
    const session = guided.state.session;
    const target = guidedTargetRef.current;
    if (!session || !target || !guided.canApply) return false;
    const isBaseBackedEmptyReset =
      session.baseMatte !== null &&
      session.strokes.length === 0 &&
      session.computedRevision !== session.revision;
    const seed =
      target.kind === "single" || target.kind === "batch"
        ? target.image
        : {
            source: session.source,
            result: session.source.blob,
            qualityMode: "isnet-q8" as const,
            alphaMatte: session.baseMatte ?? undefined,
            backgroundFill: { type: "transparent" as const },
          };
    const guidedRunId = guidedRunRef.current + 1;
    guidedRunRef.current = guidedRunId;
    retryCorrectionRef.current = () => {
      if (guidedTargetRef.current === target) void handleApplyGuided();
    };
    setCorrectionError(null);
    setFinalizingCorrection(true);
    const constraints = createGuidedBrushConstraints(session);
    const apply = target.kind === "batch" ? batch.recomposite : recomposite;
    let guidedMatte: AlphaMatte;
    try {
      guidedMatte = await guided.apply();
      if (guidedRunRef.current !== guidedRunId || guidedTargetRef.current !== target)
        return false;
    } catch (error: unknown) {
      if (guidedRunRef.current !== guidedRunId || guidedTargetRef.current !== target)
        return false;
      setFinalizingCorrection(false);
      setCorrectionError({
        message: error instanceof Error ? error.message : String(error),
        action: "retry",
      });
      return false;
    }

    if (isBaseBackedEmptyReset) {
      setFinalizingCorrection(false);
      retryCorrectionRef.current = null;
      return true;
    }

    const commitGuidedMatte = async (): Promise<boolean> => {
      try {
        const result = await apply(seed, guidedMatte);
        if (guidedRunRef.current !== guidedRunId || guidedTargetRef.current !== target)
          return false;
        const committed =
          target.kind === "batch"
            ? commitBatchResult(
                target.itemId,
                result,
                "cutout",
                m.editorHistoryCutout(),
                target.documentRevision,
                target.workerOwnerId,
              )
            : target.kind === "single"
              ? commitSingleResult(
                  result,
                  "cutout",
                  m.editorHistoryCutout(),
                  target.documentRevision,
                )
              : commitSingleResult(result, "cutout", m.editorHistoryCutout());
        if (!committed) {
          setFinalizingCorrection(false);
          return false;
        }
        guided.confirmApply(guidedMatte);
        setFinalizingCorrection(false);
        refinementContextRef.current = {
          guidedMatte,
          constraints,
        };
        if (target.kind === "batch") {
          guidedTargetRef.current = {
            ...target,
            image: result,
            documentRevision: target.documentRevision + 1,
          };
        } else if (target.kind === "single") {
          guidedTargetRef.current = {
            ...target,
            image: result,
            documentRevision: target.documentRevision + 1,
          };
        }
        retryCorrectionRef.current = null;
        return true;
      } catch (error: unknown) {
        if (guidedRunRef.current !== guidedRunId || guidedTargetRef.current !== target)
          return false;
        setFinalizingCorrection(false);
        setCorrectionError({
          message: error instanceof Error ? error.message : String(error),
          action: "retry",
        });
        retryCorrectionRef.current = () => {
          if (guidedRunRef.current !== guidedRunId || guidedTargetRef.current !== target)
            return;
          setCorrectionError(null);
          setFinalizingCorrection(true);
          void commitGuidedMatte();
        };
        return false;
      }
    };

    return commitGuidedMatte();
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

  function finishEnhancementRun(run: EnhancementRun) {
    if (enhancementRunRef.current !== run) return;
    let outcome: EnhancementControllerState["outcome"] = "unchanged";
    if (run.changed) {
      const committed =
        run.target.kind === "single"
          ? commitSingleResult(
              run.image,
              "enhance",
              run.historyLabel,
              run.target.documentRevision,
            )
          : commitBatchResult(
              run.target.itemId,
              run.image,
              "enhance",
              run.historyLabel,
              run.target.documentRevision,
              run.target.workerOwnerId,
            );
      outcome = committed ? "applied" : "kept-current";
    }
    enhancementRunRef.current = null;
    refinementTargetRef.current = null;
    foregroundTargetRef.current = null;
    setEnhancementState({
      status: "idle",
      activeOperationId: null,
      outcome,
      errorCode: null,
      documentId: run.documentId,
    });
  }

  function failEnhancementRun(run: EnhancementRun, code: "out-of-memory" | "failed") {
    if (enhancementRunRef.current !== run) return;
    enhancementRunRef.current = null;
    refinementTargetRef.current = null;
    foregroundTargetRef.current = null;
    setEnhancementState({
      status: "error",
      activeOperationId: run.operationIds[run.operationIndex] ?? null,
      outcome: null,
      errorCode: code,
      documentId: run.documentId,
    });
  }

  function startEnhancementStage(run: EnhancementRun) {
    if (enhancementRunRef.current !== run) return;
    const operationId = run.operationIds[run.operationIndex];
    const matte = run.image.alphaMatte;
    if (!operationId || !matte) {
      finishEnhancementRun(run);
      return;
    }
    setEnhancementState({
      status: "applying",
      activeOperationId: operationId,
      outcome: null,
      errorCode: null,
      documentId: run.documentId,
    });
    if (operationId === "fine-detail") {
      const target = { ...run.target, image: { ...run.image, foreground: undefined } };
      refinementTargetRef.current = target;
      appliedRefinementRef.current = null;
      refinement.start({
        source: run.image.source,
        priorMatte: matte,
        guidedMatte: refinementContextRef.current.guidedMatte,
        constraints: refinementContextRef.current.constraints,
        mode: refinementMode,
        path: deviceCapabilities?.inferencePath ?? "wasm",
      });
      return;
    }
    const target = { ...run.target, image: { ...run.image, foreground: undefined } };
    foregroundTargetRef.current = target;
    appliedForegroundRef.current = null;
    foregroundRefinement.start({
      source: run.image.source,
      matte,
      constraints: refinementContextRef.current.constraints,
      componentCleanup: true,
    });
  }

  // The run object and refs deliberately own this event-driven pipeline; a stable
  // callback would require memoizing the entire controller orchestration graph.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function continueEnhancementRun(run: EnhancementRun) {
    if (enhancementRunRef.current !== run) return;
    run.operationIndex += 1;
    if (run.operationIndex >= run.operationIds.length) {
      finishEnhancementRun(run);
      return;
    }
    const previousOperation = run.operationIds[run.operationIndex - 1];
    const releasePrevious =
      previousOperation === "fine-detail"
        ? refinement.release().then(refinement.reset)
        : foregroundRefinement.release().then(foregroundRefinement.reset);
    void releasePrevious.then(() => startEnhancementStage(run));
  }

  function beginEnhancementRun(request: EnhancementRequest) {
    if (!request.operationIds.length || !request.target.image.alphaMatte) return;
    const id = enhancementSequenceRef.current + 1;
    enhancementSequenceRef.current = id;
    const run: EnhancementRun = {
      id,
      target: request.target,
      operationIds: request.operationIds,
      operationIndex: 0,
      image: request.target.image,
      changed: false,
      historyLabel: request.historyLabel,
      documentId: request.documentId,
    };
    enhancementRequestRef.current = request;
    enhancementRunRef.current = run;
    setEnhancementState({
      status: "applying",
      activeOperationId: request.operationIds[0] ?? null,
      outcome: null,
      errorCode: null,
      documentId: request.documentId,
    });
    void Promise.all([
      releaseInference(),
      guided.release(),
      refinement.release(),
      foregroundRefinement.release(),
      request.target.kind === "batch" ? batch.releaseInference() : Promise.resolve(),
    ]).then(() => {
      if (enhancementRunRef.current !== run || enhancementSequenceRef.current !== id)
        return;
      refinement.reset();
      foregroundRefinement.reset();
      startEnhancementStage(run);
    });
  }

  function applySingleEnhancements(
    image: ProcessedImage,
    operationIds: readonly EnhancementOperationId[],
    historyLabel: string,
  ) {
    const target = targetForSingle(image);
    const documentId = singleDocumentRef.current?.document.id;
    if (target && documentId)
      beginEnhancementRun({ target, operationIds, historyLabel, documentId });
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
      beginEnhancementRun({ target, operationIds, historyLabel, documentId });
  }

  function cancelEnhancements() {
    const hadRun =
      enhancementState.status === "applying" || enhancementState.status === "error";
    enhancementSequenceRef.current += 1;
    enhancementRunRef.current = null;
    enhancementRequestRef.current = null;
    refinementTargetRef.current = null;
    foregroundTargetRef.current = null;
    refinement.cancel();
    foregroundRefinement.cancel();
    setEnhancementState({
      ...initialEnhancementState,
      outcome: hadRun ? "kept-current" : null,
      documentId: enhancementState.documentId,
    });
  }

  function retryEnhancements() {
    const request = enhancementRequestRef.current;
    if (request) beginEnhancementRun(request);
  }

  useEffect(() => {
    const result = refinement.state.result;
    const target = refinementTargetRef.current;
    const run = enhancementRunRef.current;
    if (
      !result ||
      !target ||
      !run ||
      run.operationIds[run.operationIndex] !== "fine-detail" ||
      appliedRefinementRef.current === result.matte
    )
      return;
    appliedRefinementRef.current = result.matte;
    if (!run.image.alphaMatte || sameAlphaMatte(run.image.alphaMatte, result.matte)) {
      finishRefinementApplying();
      continueEnhancementRun(run);
      return;
    }
    const apply = target.kind === "single" ? recomposite : batch.recomposite;
    void apply({ ...run.image, foreground: undefined }, result.matte)
      .then((updated) => {
        if (enhancementRunRef.current !== run || refinementTargetRef.current !== target)
          return;
        run.image = updated;
        run.changed = true;
        finishRefinementApplying();
        continueEnhancementRun(run);
      })
      .catch(() => failEnhancementRun(run, "failed"));
  }, [
    batch.recomposite,
    continueEnhancementRun,
    finishRefinementApplying,
    recomposite,
    refinement.state.result,
  ]);

  useEffect(() => {
    const error = refinement.state.error;
    const run = enhancementRunRef.current;
    if (
      refinement.state.status !== "error" ||
      !error ||
      !run ||
      run.operationIds[run.operationIndex] !== "fine-detail"
    )
      return;
    failEnhancementRun(
      run,
      error.code === "device-out-of-memory" ? "out-of-memory" : "failed",
    );
  }, [refinement.state.error, refinement.state.status]);

  useEffect(() => {
    const result = foregroundRefinement.state.result;
    const target = foregroundTargetRef.current;
    const run = enhancementRunRef.current;
    if (
      !result ||
      !target ||
      !run ||
      run.operationIds[run.operationIndex] !== "colour-halo" ||
      appliedForegroundRef.current === result.foreground
    )
      return;
    appliedForegroundRef.current = result.foreground;
    if (result.actualPath === "unchanged") {
      finishForegroundApplying();
      continueEnhancementRun(run);
      return;
    }
    const apply = target.kind === "single" ? recomposite : batch.recomposite;
    void apply({ ...run.image, foreground: result.foreground }, result.matte)
      .then((updated) => {
        if (enhancementRunRef.current !== run || foregroundTargetRef.current !== target)
          return;
        run.image = updated;
        run.changed = true;
        finishForegroundApplying();
        continueEnhancementRun(run);
      })
      .catch(() => failEnhancementRun(run, "failed"));
  }, [
    batch.recomposite,
    continueEnhancementRun,
    finishForegroundApplying,
    foregroundRefinement.state.result,
    recomposite,
  ]);

  useEffect(() => {
    const error = foregroundRefinement.state.error;
    const run = enhancementRunRef.current;
    if (
      foregroundRefinement.state.status !== "error" ||
      !error ||
      !run ||
      run.operationIds[run.operationIndex] !== "colour-halo"
    )
      return;
    failEnhancementRun(
      run,
      error.code === "device-out-of-memory" ? "out-of-memory" : "failed",
    );
  }, [foregroundRefinement.state.error, foregroundRefinement.state.status]);

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
      cancelEnhancements();
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
    cancelEnhancements();
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

  async function handleBatchDoneCorrecting(correctedMatte: AlphaMatte): Promise<boolean> {
    const target = refinementTargetRef.current;
    if (
      !selectedBatchItem?.processedImage ||
      !target ||
      target.kind !== "batch" ||
      target.itemId !== selectedBatchItem.id
    )
      return false;
    const image = selectedBatchItem.processedImage;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    setFinalizingCorrection(true);
    try {
      const updated = await batch.recomposite(image, correctedMatte);
      if (correctionRunRef.current !== runId || refinementTargetRef.current !== target)
        return false;
      const committed = commitBatchResult(
        target.itemId,
        updated,
        "manual",
        m.editorHistoryManual(),
        target.documentRevision,
        target.workerOwnerId,
      );
      if (!committed) {
        setFinalizingCorrection(false);
        return false;
      }
      refinementTargetRef.current = {
        ...target,
        image: updated,
        documentRevision: target.documentRevision + 1,
      };
      setFinalizingCorrection(false);
      return true;
    } catch (error: unknown) {
      if (correctionRunRef.current !== runId) return false;
      setFinalizingCorrection(false);
      setCorrectionError({
        message: `Could not apply mask correction: ${error instanceof Error ? error.message : String(error)}`,
        action: "retry",
      });
      return false;
    }
  }

  async function handleDoneCorrecting(correctedMatte: AlphaMatte): Promise<boolean> {
    if (state.status !== "correcting") return false;
    const target = refinementTargetRef.current;
    if (!target || target.kind !== "single") return false;
    const image = state.result;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    retryCorrectionRef.current = () => {
      if (state.status === "correcting") void handleDoneCorrecting(correctedMatte);
    };
    setCorrectionError(null);
    setFinalizingCorrection(true);
    try {
      const updated = await recomposite(image, correctedMatte);
      if (correctionRunRef.current !== runId || refinementTargetRef.current !== target)
        return false;
      if (
        !commitSingleResult(
          updated,
          "manual",
          m.editorHistoryManual(),
          target.documentRevision,
        )
      ) {
        setFinalizingCorrection(false);
        return false;
      }
      refinementTargetRef.current = {
        ...target,
        image: updated,
        documentRevision: target.documentRevision + 1,
      };
      setFinalizingCorrection(false);
      retryCorrectionRef.current = null;
      return true;
    } catch (error: unknown) {
      if (correctionRunRef.current !== runId) return false;
      setFinalizingCorrection(false);
      setCorrectionError({
        message: `Could not apply mask correction: ${error instanceof Error ? error.message : String(error)}`,
        action: "retry",
      });
      return false;
    }
  }

  function handleCancelCorrection() {
    correctionRunRef.current += 1;
    setOriginalMatte(null);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    setCorrectionError(null);
    retryCorrectionRef.current = null;
    if (state.status === "correcting") exitCorrecting(state.result);
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
    batchPreviewFills,
    setBatchPreviewFills,
    hydrated,
    guidedEntry,
    setGuidedEntry,
    guidedVisualContext,
    guided,
    guidedViewSession,
    refinement,
    foregroundRefinement,
    enhancementState,
    enhancementProgress:
      enhancementState.activeOperationId === "fine-detail"
        ? refinement.state.progress
        : enhancementState.activeOperationId === "colour-halo"
          ? foregroundRefinement.state.progress
          : null,
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
    activeEditDocument,
    historySelectors,
    lastLogMessage,
    handleUpload,
    handleUploads,
    handleReset,
    handleApplyGuided,
    handleGuideAutomaticResult,
    handleGuideBatchResult,
    applySingleEnhancements,
    applyBatchEnhancements,
    cancelEnhancements,
    retryEnhancements,
    handleRetry,
    handleEditMask,
    handleBatchEditMask,
    handleSelectBatchItem,
    handleClearBatch,
    handleBatchDoneCorrecting,
    handleDoneCorrecting,
    handleCancelCorrection,
    handleUndoDocument,
    handleRedoDocument,
    commitSingleBackground,
    commitBatchBackground,
    cancelGuided,
  };
}

export type UseToolWorkspaceControllerResult = ReturnType<
  typeof useToolWorkspaceController
>;
