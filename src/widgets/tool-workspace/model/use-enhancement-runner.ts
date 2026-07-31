import { useEffect, useRef, useState } from "react";

import type {
  AlphaMatte,
  InferencePath,
  ProcessedImage,
  RefinementConstraintMap,
} from "../../../entities/processed-image";
import { useForegroundRefinement } from "../../../features/refine-foreground";
import {
  useMatteRefinement,
  type MattingRefinementMode,
} from "../../../features/refine-matte";
import type { EnhancementOperationId } from "./enhancement-operation-registry";

export type ResultTarget =
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

export interface EnhancementRequest {
  target: ResultTarget;
  operationIds: readonly EnhancementOperationId[];
  historyLabel: string;
  documentId: string;
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

export interface EnhancementRunnerDeps {
  recompositeSingle: (
    image: ProcessedImage,
    matte: AlphaMatte,
  ) => Promise<ProcessedImage>;
  recompositeBatch: (image: ProcessedImage, matte: AlphaMatte) => Promise<ProcessedImage>;
  releaseInference: () => Promise<void>;
  guidedRelease: () => Promise<void>;
  batchReleaseInference: () => Promise<void>;
  refinementMode: MattingRefinementMode;
  inferencePath: InferencePath | undefined;
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
}

/**
 * Owns the fine-detail/colour-halo enhancement pipeline: sequencing the two
 * refinement workers, committing their results into the active document, and
 * exposing the ref pair (`refinementTargetRef`/`foregroundTargetRef`) that
 * the mask-correction flow (still in `use-tool-workspace-controller.ts`) also
 * writes into whenever it starts a new editing target — the two flows share
 * "what am I refining right now" state by design, not by accident, so the
 * refs stay caller-visible rather than fully private.
 * (PHASE_31 F-24 extraction.)
 */
export function useEnhancementRunner(deps: EnhancementRunnerDeps) {
  const {
    recompositeSingle,
    recompositeBatch,
    releaseInference,
    guidedRelease,
    batchReleaseInference,
    refinementMode,
    inferencePath,
    commitSingleResult,
    commitBatchResult,
  } = deps;

  const refinement = useMatteRefinement();
  const foregroundRefinement = useForegroundRefinement();
  const finishRefinementApplying = refinement.finishApplying;
  const finishForegroundApplying = foregroundRefinement.finishApplying;

  const [state, setState] = useState<EnhancementControllerState>(initialEnhancementState);

  const refinementContextRef = useRef<{
    guidedMatte: AlphaMatte | null;
    constraints: RefinementConstraintMap | null;
  }>({ guidedMatte: null, constraints: null });
  const refinementTargetRef = useRef<ResultTarget | null>(null);
  const appliedRefinementRef = useRef<AlphaMatte | null>(null);
  const foregroundTargetRef = useRef<ResultTarget | null>(null);
  const appliedForegroundRef = useRef<Blob | null>(null);
  const sequenceRef = useRef(0);
  const runRef = useRef<EnhancementRun | null>(null);
  const requestRef = useRef<EnhancementRequest | null>(null);

  useEffect(
    () => () => {
      sequenceRef.current += 1;
    },
    [],
  );

  function finishRun(run: EnhancementRun) {
    if (runRef.current !== run) return;
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
    runRef.current = null;
    refinementTargetRef.current = null;
    foregroundTargetRef.current = null;
    setState({
      status: "idle",
      activeOperationId: null,
      outcome,
      errorCode: null,
      documentId: run.documentId,
    });
  }

  function failRun(run: EnhancementRun, code: "out-of-memory" | "failed") {
    if (runRef.current !== run) return;
    runRef.current = null;
    refinementTargetRef.current = null;
    foregroundTargetRef.current = null;
    setState({
      status: "error",
      activeOperationId: run.operationIds[run.operationIndex] ?? null,
      outcome: null,
      errorCode: code,
      documentId: run.documentId,
    });
  }

  function startStage(run: EnhancementRun) {
    if (runRef.current !== run) return;
    const operationId = run.operationIds[run.operationIndex];
    const matte = run.image.alphaMatte;
    if (!operationId || !matte) {
      finishRun(run);
      return;
    }
    setState({
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
        path: inferencePath ?? "wasm",
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
  // callback would require memoizing the entire runner orchestration graph.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function continueRun(run: EnhancementRun) {
    if (runRef.current !== run) return;
    run.operationIndex += 1;
    if (run.operationIndex >= run.operationIds.length) {
      finishRun(run);
      return;
    }
    const previousOperation = run.operationIds[run.operationIndex - 1];
    const releasePrevious =
      previousOperation === "fine-detail"
        ? refinement.release().then(refinement.reset)
        : foregroundRefinement.release().then(foregroundRefinement.reset);
    void releasePrevious.then(() => startStage(run));
  }

  function beginRun(request: EnhancementRequest) {
    if (!request.operationIds.length || !request.target.image.alphaMatte) return;
    const id = sequenceRef.current + 1;
    sequenceRef.current = id;
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
    requestRef.current = request;
    runRef.current = run;
    setState({
      status: "applying",
      activeOperationId: request.operationIds[0] ?? null,
      outcome: null,
      errorCode: null,
      documentId: request.documentId,
    });
    void Promise.all([
      releaseInference(),
      guidedRelease(),
      refinement.release(),
      foregroundRefinement.release(),
      request.target.kind === "batch" ? batchReleaseInference() : Promise.resolve(),
    ]).then(() => {
      if (runRef.current !== run || sequenceRef.current !== id) return;
      refinement.reset();
      foregroundRefinement.reset();
      startStage(run);
    });
  }

  function cancel() {
    const hadRun = state.status === "applying" || state.status === "error";
    sequenceRef.current += 1;
    runRef.current = null;
    requestRef.current = null;
    refinementTargetRef.current = null;
    foregroundTargetRef.current = null;
    refinement.cancel();
    foregroundRefinement.cancel();
    setState({
      ...initialEnhancementState,
      outcome: hadRun ? "kept-current" : null,
      documentId: state.documentId,
    });
  }

  function retry() {
    const request = requestRef.current;
    if (request) beginRun(request);
  }

  async function releaseBeforeHeavyWork() {
    sequenceRef.current += 1;
    runRef.current = null;
    requestRef.current = null;
    setState(initialEnhancementState);
    await Promise.all([refinement.release(), foregroundRefinement.release()]);
    refinement.reset();
    foregroundRefinement.reset();
    refinementTargetRef.current = null;
    appliedRefinementRef.current = null;
    foregroundTargetRef.current = null;
    appliedForegroundRef.current = null;
  }

  useEffect(() => {
    const result = refinement.state.result;
    const target = refinementTargetRef.current;
    const run = runRef.current;
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
      continueRun(run);
      return;
    }
    const apply = target.kind === "single" ? recompositeSingle : recompositeBatch;
    void apply({ ...run.image, foreground: undefined }, result.matte)
      .then((updated) => {
        if (runRef.current !== run || refinementTargetRef.current !== target) return;
        run.image = updated;
        run.changed = true;
        finishRefinementApplying();
        continueRun(run);
      })
      .catch(() => failRun(run, "failed"));
  }, [
    continueRun,
    finishRefinementApplying,
    recompositeBatch,
    recompositeSingle,
    refinement.state.result,
  ]);

  useEffect(() => {
    const error = refinement.state.error;
    const run = runRef.current;
    if (
      refinement.state.status !== "error" ||
      !error ||
      !run ||
      run.operationIds[run.operationIndex] !== "fine-detail"
    )
      return;
    failRun(run, error.code === "device-out-of-memory" ? "out-of-memory" : "failed");
  }, [refinement.state.error, refinement.state.status]);

  useEffect(() => {
    const result = foregroundRefinement.state.result;
    const target = foregroundTargetRef.current;
    const run = runRef.current;
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
      continueRun(run);
      return;
    }
    const apply = target.kind === "single" ? recompositeSingle : recompositeBatch;
    void apply({ ...run.image, foreground: result.foreground }, result.matte)
      .then((updated) => {
        if (runRef.current !== run || foregroundTargetRef.current !== target) return;
        run.image = updated;
        run.changed = true;
        finishForegroundApplying();
        continueRun(run);
      })
      .catch(() => failRun(run, "failed"));
  }, [
    continueRun,
    finishForegroundApplying,
    foregroundRefinement.state.result,
    recompositeBatch,
    recompositeSingle,
  ]);

  useEffect(() => {
    const error = foregroundRefinement.state.error;
    const run = runRef.current;
    if (
      foregroundRefinement.state.status !== "error" ||
      !error ||
      !run ||
      run.operationIds[run.operationIndex] !== "colour-halo"
    )
      return;
    failRun(run, error.code === "device-out-of-memory" ? "out-of-memory" : "failed");
  }, [foregroundRefinement.state.error, foregroundRefinement.state.status]);

  return {
    state,
    progress:
      state.activeOperationId === "fine-detail"
        ? refinement.state.progress
        : state.activeOperationId === "colour-halo"
          ? foregroundRefinement.state.progress
          : null,
    refinement,
    foregroundRefinement,
    refinementContextRef,
    refinementTargetRef,
    appliedRefinementRef,
    foregroundTargetRef,
    appliedForegroundRef,
    run: beginRun,
    cancel,
    retry,
    releaseBeforeHeavyWork,
  };
}
