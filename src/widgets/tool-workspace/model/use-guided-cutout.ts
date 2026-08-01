import { useCallback, useRef, useState, type RefObject } from "react";

import {
  createEditDocumentScope,
  type EditDocumentScope,
} from "../../../entities/edit-document";
import type {
  AlphaMatte,
  InferencePath,
  ProcessedImage,
  RefinementConstraintMap,
} from "../../../entities/processed-image";
import type { BatchItem } from "../../../features/batch-processing";
import type { RemoveBackgroundState } from "../../../features/remove-background";
import {
  createGuidedBrushConstraints,
  useGuidedBrushSelection,
} from "../../../features/select-object";
import { m } from "@/paraglide/messages";

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

export interface GuidedCutoutDeps {
  guided: ReturnType<typeof useGuidedBrushSelection>;
  singleDocumentRef: RefObject<EditDocumentScope | null>;
  publishSingleDocument: (scope: EditDocumentScope | null) => void;
  selectedBatchItem: BatchItem | undefined;
  removalState: RemoveBackgroundState;
  inferencePath: InferencePath | undefined;
  extractMatte: (image: ProcessedImage) => Promise<AlphaMatte>;
  batchExtractMatte: (image: ProcessedImage) => Promise<AlphaMatte>;
  releaseInference: () => Promise<void>;
  recompositeSingle: (
    image: ProcessedImage,
    matte: AlphaMatte,
  ) => Promise<ProcessedImage>;
  recompositeBatch: (image: ProcessedImage, matte: AlphaMatte) => Promise<ProcessedImage>;
  commitSingleResult: (
    image: ProcessedImage,
    kind: "cutout" | "manual" | "enhance" | "background",
    label: string,
    expectedRevision?: number,
  ) => boolean;
  commitBatchResult: (
    itemId: string,
    image: ProcessedImage,
    kind: "cutout" | "manual" | "enhance" | "background",
    label: string,
    expectedRevision?: number,
    workerOwnerId?: string,
  ) => boolean;
  releaseRefinementBeforeHeavyWork: () => Promise<void>;
  refinementRelease: () => Promise<void>;
  refinementReset: () => void;
  foregroundRefinementRelease: () => Promise<void>;
  foregroundRefinementReset: () => void;
  batchReleaseInference: () => Promise<void>;
  refinementContextRef: RefObject<{
    guidedMatte: AlphaMatte | null;
    constraints: RefinementConstraintMap | null;
  }>;
  retryCorrectionRef: RefObject<(() => void) | null>;
  setCorrectionError: (error: WorkspaceDisplayError | null) => void;
  setExtractingMatte: (value: boolean) => void;
  setFinalizingCorrection: (value: boolean) => void;
}

/**
 * Owns the guided ("magic") cutout target-tracking and its three async entry
 * points (apply a brush session, extract-and-enter from a finished single
 * result, extract-and-enter from a finished batch item). Takes the
 * `useGuidedBrushSelection()` result and the enhancement-runner's
 * refinement/refinement-context handles as explicit dependencies rather than
 * owning them, since `guided.release` is also needed by
 * `use-enhancement-runner.ts` and instantiating `useGuidedBrushSelection`
 * here would create a circular dependency between the two sub-hooks.
 * (PHASE_31 F-24 extraction, second slice.)
 */
export function useGuidedCutout(deps: GuidedCutoutDeps) {
  const {
    guided,
    singleDocumentRef,
    publishSingleDocument,
    selectedBatchItem,
    removalState,
    inferencePath,
    extractMatte,
    batchExtractMatte,
    releaseInference,
    recompositeSingle,
    recompositeBatch,
    commitSingleResult,
    commitBatchResult,
    releaseRefinementBeforeHeavyWork,
    refinementRelease,
    refinementReset,
    foregroundRefinementRelease,
    foregroundRefinementReset,
    batchReleaseInference,
    refinementContextRef,
    retryCorrectionRef,
    setCorrectionError,
    setExtractingMatte,
    setFinalizingCorrection,
  } = deps;

  const [guidedEntry, setGuidedEntry] = useState(false);
  const [guidedVisualContext, setGuidedVisualContext] =
    useState<GuidedBrushVisualContext | null>(null);

  const guidedRunRef = useRef(0);
  const guidedTargetRef = useRef<GuidedTarget | null>(null);
  const guidedApplyRef = useRef<Promise<boolean> | null>(null);

  async function performApplyGuided(): Promise<boolean> {
    const session = guided.state.session;
    const target = guidedTargetRef.current;
    if (!session || !target || !guided.canApply) return false;
    const expectedDocumentRevision =
      target.kind === "single"
        ? (singleDocumentRef.current?.document.revision ?? target.documentRevision)
        : target.kind === "batch"
          ? (selectedBatchItem?.editDocument?.document.revision ??
            target.documentRevision)
          : null;
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
    const apply = target.kind === "batch" ? recompositeBatch : recompositeSingle;
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
                expectedDocumentRevision ?? target.documentRevision,
                target.workerOwnerId,
              )
            : target.kind === "single"
              ? commitSingleResult(
                  result,
                  "cutout",
                  m.editorHistoryCutout(),
                  expectedDocumentRevision ?? target.documentRevision,
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
            documentRevision: (expectedDocumentRevision ?? target.documentRevision) + 1,
          };
        } else if (target.kind === "single") {
          guidedTargetRef.current = {
            ...target,
            image: result,
            documentRevision: (expectedDocumentRevision ?? target.documentRevision) + 1,
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

  function handleApplyGuided(): Promise<boolean> {
    const active = guidedApplyRef.current;
    if (active) return active;
    const promise = performApplyGuided();
    guidedApplyRef.current = promise;
    function releaseApplyOwnership(): void {
      if (guidedApplyRef.current === promise) guidedApplyRef.current = null;
    }
    void promise.then(releaseApplyOwnership, releaseApplyOwnership);
    return promise;
  }

  function handleGuideAutomaticResult() {
    if (removalState.status !== "result") return;
    const image = removalState.result;
    const guidedRunId = guidedRunRef.current + 1;
    guidedRunRef.current = guidedRunId;
    retryCorrectionRef.current = () => {
      if (removalState.status === "result") handleGuideAutomaticResult();
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
            { inferencePath: inferencePath ?? null },
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
        guided.hydrate(image.source, matte);
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
          refinementRelease().then(refinementReset),
          foregroundRefinementRelease().then(foregroundRefinementReset),
          batchReleaseInference(),
        ]);
        if (guidedRunRef.current !== guidedRunId) return;
        const matte =
          processedImage.alphaMatte ?? (await batchExtractMatte(processedImage));
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
        guided.hydrate(processedImage.source, matte);
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

  function synchronizeSingleGuidedTarget(
    image: ProcessedImage,
    document: EditDocumentScope,
  ): void {
    if (!guided.state.session || !image.alphaMatte) return;
    guidedRunRef.current += 1;
    guidedApplyRef.current = null;
    guidedTargetRef.current = {
      kind: "single",
      image,
      documentRevision: document.document.revision,
    };
    setGuidedVisualContext({
      entryKind: "processed",
      resultColorSource: image.foreground ?? image.source.blob,
    });
    guided.replaceBase(image.alphaMatte);
  }

  function synchronizeBatchGuidedTarget(item: BatchItem): void {
    if (!guided.state.session || !item.processedImage?.alphaMatte || !item.editDocument)
      return;
    guidedRunRef.current += 1;
    guidedApplyRef.current = null;
    guidedTargetRef.current = {
      kind: "batch",
      itemId: item.id,
      image: item.processedImage,
      documentRevision: item.editDocument.document.revision,
      workerOwnerId: item.editDocument.workerOwnerId,
    };
    setGuidedVisualContext({
      entryKind: "processed",
      resultColorSource:
        item.processedImage.foreground ?? item.processedImage.source.blob,
    });
    guided.replaceBase(item.processedImage.alphaMatte);
  }

  function cancelGuided() {
    guidedRunRef.current += 1;
    guidedApplyRef.current = null;
    guided.reset();
    guidedTargetRef.current = null;
    setGuidedVisualContext(null);
    setGuidedEntry(false);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    setCorrectionError(null);
    retryCorrectionRef.current = null;
  }

  const bumpGuidedRun = useCallback((): number => {
    guidedRunRef.current += 1;
    guidedApplyRef.current = null;
    return guidedRunRef.current;
  }, []);

  function setGuidedTarget(target: GuidedTarget | null) {
    guidedTargetRef.current = target;
  }

  return {
    guidedRunRef,
    guidedTargetRef,
    guidedEntry,
    setGuidedEntry,
    guidedVisualContext,
    setGuidedVisualContext,
    bumpGuidedRun,
    setGuidedTarget,
    handleApplyGuided,
    handleGuideAutomaticResult,
    handleGuideBatchResult,
    synchronizeSingleGuidedTarget,
    synchronizeBatchGuidedTarget,
    cancelGuided,
  };
}
