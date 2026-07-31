import { useCallback, useRef, useState, type RefObject } from "react";

import {
  createEditDocumentScope,
  type EditDocumentScope,
} from "../../../entities/edit-document";
import type {
  AlphaMatte,
  InferencePath,
  ProcessedImage,
} from "../../../entities/processed-image";
import type { BatchItem } from "../../../features/batch-processing";
import type { RemoveBackgroundState } from "../../../features/remove-background";
import { m } from "@/paraglide/messages";
import type { ResultTarget } from "./use-enhancement-runner";
import type { WorkspaceDisplayError } from "./use-guided-cutout";

export interface MaskCorrectionFlowDeps {
  singleDocumentRef: RefObject<EditDocumentScope | null>;
  publishSingleDocument: (scope: EditDocumentScope | null) => void;
  selectedBatchItem: BatchItem | undefined;
  removalState: RemoveBackgroundState;
  inferencePath: InferencePath | undefined;
  extractMatte: (image: ProcessedImage) => Promise<AlphaMatte>;
  batchExtractMatte: (image: ProcessedImage) => Promise<AlphaMatte>;
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
  enterCorrecting: () => void;
  exitCorrecting: (result: ProcessedImage) => void;
  refinementTargetRef: RefObject<ResultTarget | null>;
  retryCorrectionRef: RefObject<(() => void) | null>;
  setCorrectionError: (error: WorkspaceDisplayError | null) => void;
  setExtractingMatte: (value: boolean) => void;
  setFinalizingCorrection: (value: boolean) => void;
}

/**
 * Owns the manual mask-correction entry/exit/commit flow: extracting or
 * reusing the alpha matte to enter the correction canvas, and committing the
 * brush-corrected matte back into the active document for both the single
 * and batch surfaces. Shares `refinementTargetRef`, `retryCorrectionRef`,
 * `setCorrectionError`, `setExtractingMatte`, and `setFinalizingCorrection`
 * with `use-guided-cutout.ts` (both flows drive the same error/loading
 * display and the same "what am I refining" target) — those stay owned by
 * the controller and are passed in here as explicit dependencies rather than
 * duplicated. (PHASE_31 F-24 extraction, third slice.)
 */
export function useMaskCorrectionFlow(deps: MaskCorrectionFlowDeps) {
  const {
    singleDocumentRef,
    publishSingleDocument,
    selectedBatchItem,
    removalState,
    inferencePath,
    extractMatte,
    batchExtractMatte,
    recompositeSingle,
    recompositeBatch,
    commitSingleResult,
    commitBatchResult,
    enterCorrecting,
    exitCorrecting,
    refinementTargetRef,
    retryCorrectionRef,
    setCorrectionError,
    setExtractingMatte,
    setFinalizingCorrection,
  } = deps;

  const [originalMatte, setOriginalMatte] = useState<AlphaMatte | null>(null);
  const correctionRunRef = useRef(0);

  function handleEditMask() {
    if (removalState.status !== "result") return;
    const image = removalState.result;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    retryCorrectionRef.current = () => {
      if (removalState.status === "result") handleEditMask();
    };
    setCorrectionError(null);
    if (image.alphaMatte) {
      let scope = singleDocumentRef.current;
      if (!scope) {
        scope = createEditDocumentScope(image, {
          inferencePath: inferencePath ?? null,
        });
        publishSingleDocument(scope);
      }
      setExtractingMatte(false);
      setOriginalMatte(image.alphaMatte);
      retryCorrectionRef.current = null;
      refinementTargetRef.current = {
        kind: "single",
        image,
        documentRevision: scope.document.revision,
      };
      enterCorrecting();
      return;
    }
    setExtractingMatte(true);
    void extractMatte(image)
      .then((matte) => {
        if (correctionRunRef.current !== runId) return;
        let scope = singleDocumentRef.current;
        if (!scope) {
          scope = createEditDocumentScope(
            { ...image, alphaMatte: matte },
            { inferencePath: inferencePath ?? null },
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
    refinementTargetRef.current = {
      kind: "batch",
      itemId: selectedBatchItem.id,
      image,
      documentRevision: selectedBatchItem.editDocument.document.revision,
      workerOwnerId: selectedBatchItem.editDocument.workerOwnerId,
    };
    if (image.alphaMatte) {
      setExtractingMatte(false);
      setOriginalMatte(image.alphaMatte);
      return;
    }
    setExtractingMatte(true);
    void batchExtractMatte(image)
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
      const updated = await recompositeBatch(image, correctedMatte);
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
    if (removalState.status !== "correcting") return false;
    const target = refinementTargetRef.current;
    if (!target || target.kind !== "single") return false;
    const image = removalState.result;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    retryCorrectionRef.current = () => {
      if (removalState.status === "correcting") void handleDoneCorrecting(correctedMatte);
    };
    setCorrectionError(null);
    setFinalizingCorrection(true);
    try {
      const updated = await recompositeSingle(image, correctedMatte);
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
    if (removalState.status === "correcting") exitCorrecting(removalState.result);
  }

  const bumpCorrectionRun = useCallback((): number => {
    correctionRunRef.current += 1;
    return correctionRunRef.current;
  }, []);

  return {
    originalMatte,
    setOriginalMatte,
    correctionRunRef,
    bumpCorrectionRun,
    handleEditMask,
    handleBatchEditMask,
    handleBatchDoneCorrecting,
    handleDoneCorrecting,
    handleCancelCorrection,
  };
}
