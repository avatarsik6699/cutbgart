import { useCallback, useEffect, useRef, useState } from "react";

import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import { rankGuidedBrushCandidates } from "./candidate-ranking";
import {
  appendGuidedBrushStroke,
  canApplyGuidedBrushSession,
  canAcceptGuidedBrushSession,
  cancelGuidedBrushDraft,
  clearGuidedBrushStrokes,
  continueGuidedBrushFromResult,
  createGuidedBrushId,
  createGuidedBrushSession,
  redoGuidedBrushStroke,
  restoreGuidedBrushBase,
  selectGuidedBrushCandidate,
  setGuidedBrushCandidates,
  setGuidedBrushRadius,
  undoGuidedBrushStroke,
} from "./guided-brush-session";
import { consolidateGuidedBrushStrokes } from "./guided-brush-sampling";
import { fuseGuidedMattes } from "./guided-fusion";
import {
  addLayer as addSessionLayer,
  appendPoint,
  appendStroke,
  createPromptId,
  createPromptSession,
  redoPrompt,
  removeLayer as removeSessionLayer,
  resetLayer as resetSessionLayer,
  selectCandidate as selectSessionCandidate,
  selectLayer as selectSessionLayer,
  setLayerCandidates,
  setTargetBox,
  undoPrompt,
} from "./prompt-session";
import { sampleSemanticStroke } from "./semantic-stroke";
import type {
  GuidedBox,
  GuidedBrushMode,
  GuidedBrushSession,
  GuidedBrushStroke,
  GuidedBrushStatus,
  GuidedPoint,
  ObjectSelectionStatus,
  PromptPointLabel,
  PromptSession,
  SelectObjectWorkerRequest,
  SelectObjectWorkerResponse,
  SemanticStroke,
} from "./types";

export interface ObjectSelectionState {
  status: ObjectSelectionStatus;
  session: PromptSession | null;
  matte: AlphaMatte | null;
  error: string | null;
  progress: number | null;
}

const initialState: ObjectSelectionState = {
  status: "idle",
  session: null,
  matte: null,
  error: null,
  progress: null,
};

const createDefaultSelectObjectWorker = () =>
  new Worker(new URL("../worker/select-object.worker.ts", import.meta.url), {
    type: "module",
  });

export function useObjectSelection(workerFactory = createDefaultSelectObjectWorker) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const matteRef = useRef<AlphaMatte | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const revisionRef = useRef(0);
  const pendingReleaseRef = useRef<(() => void) | null>(null);

  const commitState = useCallback((next: ObjectSelectionState) => {
    stateRef.current = next;
    matteRef.current = next.matte;
    setState(next);
  }, []);

  const fail = useCallback(
    (message: string) => {
      commitState({
        ...stateRef.current,
        status: "error",
        error: message,
        progress: null,
      });
    },
    [commitState],
  );

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = workerFactory();
    worker.addEventListener(
      "message",
      (event: MessageEvent<SelectObjectWorkerResponse>) => {
        const message = event.data;
        if (message.revision !== revisionRef.current) return;
        if (message.type === "disposed") {
          pendingReleaseRef.current?.();
          pendingReleaseRef.current = null;
          return;
        }
        if (message.type === "status") {
          commitState({
            ...stateRef.current,
            status: message.status,
            error: null,
            progress: message.progress ?? null,
          });
          return;
        }
        if (message.type === "error") {
          fail(message.message);
          return;
        }
        if (message.type === "guided-candidates") return;
        const current = stateRef.current.session;
        if (!current) return;
        const nextSession = setLayerCandidates(
          current,
          current.activeLayerId,
          message.candidates,
        );
        commitState({
          ...stateRef.current,
          status: "preview",
          session: nextSession,
          matte: fuseGuidedMattes({
            baseMatte: nextSession.baseMatte,
            layers: nextSession.layers,
            width: nextSession.source.width,
            height: nextSession.source.height,
          }),
          error: null,
          progress: null,
        });
      },
    );
    worker.addEventListener("error", (event) => {
      event.preventDefault();
      if (workerRef.current !== worker) return;
      worker.terminate();
      workerRef.current = null;
      fail(
        event instanceof ErrorEvent && event.message
          ? event.message
          : "Guided-selection worker stopped unexpectedly",
      );
    });
    worker.addEventListener("messageerror", () => {
      if (workerRef.current === worker)
        fail("Guided-selection worker returned an unreadable response");
    });
    workerRef.current = worker;
    return worker;
  }, [commitState, fail, workerFactory]);

  const post = useCallback(
    (request: SelectObjectWorkerRequest) => {
      try {
        getWorker().postMessage(request);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    },
    [fail, getWorker],
  );

  const withRevision = useCallback((session: PromptSession): PromptSession => {
    revisionRef.current += 1;
    return { ...session, revision: revisionRef.current };
  }, []);

  const infer = useCallback(
    (session: PromptSession, previousMask: AlphaMatte | null = null) => {
      const layer = session.layers.find((item) => item.id === session.activeLayerId);
      if (!layer) return;
      const strokePoints: GuidedPoint[] = layer.strokes.flatMap((stroke) =>
        sampleSemanticStroke(stroke).map((point, index) => ({
          id: `${stroke.id}-sample-${String(index)}`,
          ...point,
          label: stroke.mode === "keep" ? 1 : 0,
        })),
      );
      if (!layer.points.length && !layer.targetBox && !strokePoints.length) {
        const hasAccepted = session.layers.some((item) => item.acceptedMatte);
        commitState({
          ...stateRef.current,
          session,
          status: hasAccepted ? "preview" : "ready-for-prompt",
          matte: hasAccepted
            ? fuseGuidedMattes({
                baseMatte: session.baseMatte,
                layers: session.layers,
                width: session.source.width,
                height: session.source.height,
              })
            : session.baseMatte,
        });
        return;
      }
      commitState({
        ...stateRef.current,
        session,
        status: "predicting-mask",
        error: null,
        progress: null,
      });
      post({
        type: "prompt",
        prompt: {
          revision: session.revision,
          points: [...layer.points, ...strokePoints],
          box: layer.targetBox,
          previousMask: previousMask ?? layer.acceptedMatte,
        },
      });
    },
    [commitState, post],
  );

  const start = useCallback(
    (source: SourceImage, baseMatte: AlphaMatte | null = null) => {
      workerRef.current?.terminate();
      workerRef.current = null;
      const session = withRevision(createPromptSession(source, baseMatte));
      commitState({
        status: "loading-model",
        session,
        matte: baseMatte,
        error: null,
        progress: 0,
      });
      post({ type: "encode", revision: session.revision, source });
    },
    [commitState, post, withRevision],
  );

  const updateAndInfer = useCallback(
    (update: (session: PromptSession) => PromptSession) => {
      const current = stateRef.current.session;
      if (!current) return;
      const previousMask =
        current.layers.find((layer) => layer.id === current.activeLayerId)
          ?.acceptedMatte ?? null;
      infer(withRevision(update(current)), previousMask);
    },
    [infer, withRevision],
  );

  const addPoint = useCallback(
    (x: number, y: number, label: PromptPointLabel) =>
      updateAndInfer((session) =>
        appendPoint(session, { id: createPromptId("point"), x, y, label }),
      ),
    [updateAndInfer],
  );
  const setBox = useCallback(
    (box: GuidedBox) => updateAndInfer((session) => setTargetBox(session, box)),
    [updateAndInfer],
  );
  const addStroke = useCallback(
    (stroke: Omit<SemanticStroke, "id">) =>
      updateAndInfer((session) =>
        appendStroke(session, { ...stroke, id: createPromptId("stroke") }),
      ),
    [updateAndInfer],
  );
  const updateSessionOnly = useCallback(
    (update: (session: PromptSession) => PromptSession) => {
      const current = stateRef.current.session;
      if (!current) return;
      const session = withRevision(update(current));
      const hasAccepted = session.layers.some((layer) => layer.acceptedMatte);
      commitState({
        ...stateRef.current,
        session,
        status: hasAccepted ? "preview" : "ready-for-prompt",
        matte: hasAccepted
          ? fuseGuidedMattes({
              baseMatte: session.baseMatte,
              layers: session.layers,
              width: session.source.width,
              height: session.source.height,
            })
          : session.baseMatte,
      });
    },
    [commitState, withRevision],
  );
  const addLayer = useCallback(
    () => updateSessionOnly((session) => addSessionLayer(session)),
    [updateSessionOnly],
  );
  const selectLayer = useCallback(
    (id: string) => updateSessionOnly((session) => selectSessionLayer(session, id)),
    [updateSessionOnly],
  );
  const removeLayer = useCallback(
    (id: string) => updateSessionOnly((session) => removeSessionLayer(session, id)),
    [updateSessionOnly],
  );
  const resetLayer = useCallback(
    () => updateAndInfer((session) => resetSessionLayer(session)),
    [updateAndInfer],
  );
  const undo = useCallback(() => updateAndInfer(undoPrompt), [updateAndInfer]);
  const redo = useCallback(() => updateAndInfer(redoPrompt), [updateAndInfer]);

  const selectCandidate = useCallback(
    (id: string) => {
      const current = stateRef.current.session;
      if (!current) return;
      const session = withRevision(selectSessionCandidate(current, id));
      commitState({
        ...stateRef.current,
        session,
        status: "preview",
        matte: fuseGuidedMattes({
          baseMatte: session.baseMatte,
          layers: session.layers,
          width: session.source.width,
          height: session.source.height,
        }),
      });
    },
    [commitState, withRevision],
  );

  const retry = useCallback(() => {
    const session = stateRef.current.session;
    if (!session) return;
    if (!workerRef.current) start(session.source, session.baseMatte);
    else infer(withRevision(session));
  }, [infer, start, withRevision]);

  const reset = useCallback(() => {
    revisionRef.current += 1;
    workerRef.current?.postMessage({ type: "reset", revision: revisionRef.current });
    workerRef.current?.terminate();
    workerRef.current = null;
    commitState(initialState);
  }, [commitState]);

  const release = useCallback((): Promise<void> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve();
    revisionRef.current += 1;
    return new Promise((resolve) => {
      pendingReleaseRef.current = resolve;
      worker.postMessage({ type: "dispose", revision: revisionRef.current });
    });
  }, []);

  useEffect(() => reset, [reset]);
  return {
    state,
    matteRef,
    start,
    addPoint,
    setBox,
    addStroke,
    addLayer,
    selectLayer,
    removeLayer,
    selectCandidate,
    undo,
    redo,
    resetLayer,
    replacePrompt: resetLayer,
    retry,
    release,
    reset,
  };
}

export interface GuidedBrushSelectionState {
  status: GuidedBrushStatus;
  session: GuidedBrushSession | null;
  matte: AlphaMatte | null;
  error: string | null;
  errorCode: "keep-required" | "marking-required" | "worker-failed" | null;
  progress: number | null;
  lastPromptCount: number | null;
  lastPromptKeepCount: number | null;
  lastPromptRemoveCount: number | null;
  baseMatteRevision: number | null;
}

const initialBrushState: GuidedBrushSelectionState = {
  status: "idle",
  session: null,
  matte: null,
  error: null,
  errorCode: null,
  progress: null,
  lastPromptCount: null,
  lastPromptKeepCount: null,
  lastPromptRemoveCount: null,
  baseMatteRevision: null,
};

function createLightweightGuidedPoints(
  strokes: readonly GuidedBrushStroke[],
): GuidedPoint[] {
  const pointsByMode = {
    keep: strokes
      .filter((stroke) => stroke.mode === "keep")
      .flatMap((stroke) => stroke.points),
    remove: strokes
      .filter((stroke) => stroke.mode === "remove")
      .flatMap((stroke) => stroke.points),
  };
  function sample(
    mode: GuidedBrushMode,
    points: readonly { x: number; y: number }[],
    count: number,
  ): GuidedPoint[] {
    return Array.from({ length: Math.min(points.length, count) }, (_, index) => {
      const sourceIndex = Math.min(
        points.length - 1,
        Math.floor(((index + 0.5) * points.length) / Math.min(points.length, count)),
      );
      const point = points[sourceIndex]!;
      return {
        id: `brush-preview-${mode}-${String(index)}`,
        x: point.x,
        y: point.y,
        label: mode === "keep" ? 1 : 0,
      };
    });
  }
  const hasBoth = pointsByMode.keep.length > 0 && pointsByMode.remove.length > 0;
  const keepLimit = hasBoth ? 16 : 32;
  const removeLimit = hasBoth ? 16 : 32;
  return [
    ...sample("keep", pointsByMode.keep, keepLimit),
    ...sample("remove", pointsByMode.remove, removeLimit),
  ];
}

/**
 * Phase-21 primary guided flow. Phase-17's `useObjectSelection` remains above
 * as compatibility source, while this orchestrator makes inference an
 * explicit action over one compact brush session.
 */
export function useGuidedBrushSelection(workerFactory = createDefaultSelectObjectWorker) {
  const [state, setState] = useState(initialBrushState);
  const stateRef = useRef(initialBrushState);
  const matteRef = useRef<AlphaMatte | null>(null);
  const baseMatteRef = useRef<AlphaMatte | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const revisionRef = useRef(0);
  const pendingReleaseRef = useRef<(() => void) | null>(null);
  const releasePromiseRef = useRef<Promise<void> | null>(null);
  const releaseWorkerRef = useRef<Worker | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingApplyRef = useRef<{
    revision: number;
    promise: Promise<AlphaMatte>;
    resolve: (matte: AlphaMatte) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const commitState = useCallback((next: GuidedBrushSelectionState) => {
    stateRef.current = next;
    matteRef.current = next.matte;
    baseMatteRef.current = next.session?.baseMatte ?? null;
    setState(next);
  }, []);

  const fail = useCallback(
    (
      message: string,
      errorCode: GuidedBrushSelectionState["errorCode"] = "worker-failed",
    ) => {
      const current = stateRef.current;
      const pendingApply = pendingApplyRef.current;
      pendingApplyRef.current = null;
      pendingApply?.reject(new Error(message));
      commitState({
        ...current,
        status: "error",
        session: current.session
          ? { ...current.session, status: "error" }
          : current.session,
        error: message,
        errorCode,
        progress: null,
      });
    },
    [commitState],
  );

  const continueFromResult = useCallback(() => {
    const current = stateRef.current;
    const session = current.session;
    const matte = current.matte;
    if (!session || !matte) return;
    const nextSession = continueGuidedBrushFromResult(session, matte);
    if (nextSession === session) return;
    revisionRef.current = nextSession.revision;
    commitState({
      ...current,
      status: "preview",
      session: nextSession,
      matte,
      error: null,
      errorCode: null,
      progress: null,
      lastPromptCount: null,
      lastPromptKeepCount: null,
      lastPromptRemoveCount: null,
      baseMatteRevision: nextSession.revision,
    });
  }, [commitState]);

  const finishRelease = useCallback((worker: Worker | null = null) => {
    if (worker && releaseWorkerRef.current !== worker) return;
    const releasedWorker = releaseWorkerRef.current;
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    if (releasedWorker && workerRef.current === releasedWorker) {
      releasedWorker.terminate();
      workerRef.current = null;
    }
    releaseWorkerRef.current = null;
    const resolve = pendingReleaseRef.current;
    pendingReleaseRef.current = null;
    releasePromiseRef.current = null;
    resolve?.();
  }, []);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = workerFactory();
    worker.addEventListener(
      "message",
      (event: MessageEvent<SelectObjectWorkerResponse>) => {
        const message = event.data;
        if (message.type === "disposed") {
          finishRelease(worker);
          return;
        }
        if (message.revision !== revisionRef.current) return;
        const current = stateRef.current;
        const session = current.session;
        if (!session || session.revision !== message.revision) return;
        if (message.type === "status") {
          const status: GuidedBrushStatus =
            message.status === "ready-for-prompt"
              ? session.strokes.length
                ? "dirty"
                : "ready"
              : message.status === "predicting-mask"
                ? "predicting"
                : message.status;
          commitState({
            ...current,
            status,
            session: { ...session, status },
            error: null,
            errorCode: null,
            progress: message.progress ?? null,
          });
          return;
        }
        if (message.type === "error") {
          fail(message.message);
          return;
        }
        try {
          const fallbackConsolidated =
            message.type === "candidates"
              ? consolidateGuidedBrushStrokes(
                  session.strokes,
                  session.source.width,
                  session.source.height,
                )
              : null;
          const editRegion =
            message.type === "guided-candidates"
              ? message.editRegion
              : fallbackConsolidated?.editRegion;
          if (!editRegion) {
            fail("Add a brush marking before recomputing", "marking-required");
            return;
          }
          const rankedCandidates =
            message.type === "guided-candidates"
              ? message.candidates
              : rankGuidedBrushCandidates(
                  message.candidates,
                  fallbackConsolidated!.constraints,
                  editRegion,
                  session.baseMatte,
                  fallbackConsolidated!.influence,
                );
          if (!rankedCandidates.length) {
            fail("SlimSAM returned no usable mask candidates");
            return;
          }
          const candidates = rankedCandidates;
          const nextSession = setGuidedBrushCandidates(session, candidates, editRegion);
          const selected =
            candidates.find(
              (candidate) => candidate.id === nextSession.selectedCandidateId,
            ) ?? candidates[0]!;
          const pendingApply = pendingApplyRef.current;
          if (pendingApply?.revision === session.revision) {
            pendingApplyRef.current = null;
            commitState({
              ...current,
              status: "preview",
              session: nextSession,
              matte: selected.matte,
              error: null,
              errorCode: null,
              progress: null,
            });
            pendingApply.resolve(selected.matte);
            return;
          }
          commitState({
            ...current,
            status: "preview",
            session: nextSession,
            matte: selected.matte,
            error: null,
            errorCode: null,
            progress: null,
          });
        } catch (error) {
          if (workerRef.current === worker) {
            worker.terminate();
            workerRef.current = null;
          }
          fail(
            error instanceof Error
              ? error.message
              : "Guided-selection worker returned an invalid candidate",
          );
        }
      },
    );
    worker.addEventListener("error", (event) => {
      event.preventDefault();
      if (workerRef.current !== worker) return;
      if (releaseWorkerRef.current === worker) {
        finishRelease(worker);
        return;
      }
      worker.terminate();
      workerRef.current = null;
      fail(
        event instanceof ErrorEvent && event.message
          ? event.message
          : "Guided-selection worker stopped unexpectedly",
      );
    });
    worker.addEventListener("messageerror", () => {
      if (releaseWorkerRef.current === worker) finishRelease(worker);
      else if (workerRef.current === worker) {
        worker.terminate();
        workerRef.current = null;
        fail("Guided-selection worker returned an unreadable response");
      }
    });
    workerRef.current = worker;
    return worker;
  }, [commitState, fail, finishRelease, workerFactory]);

  const post = useCallback(
    (request: SelectObjectWorkerRequest) => {
      try {
        getWorker().postMessage(request);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    },
    [fail, getWorker],
  );

  const start = useCallback(
    (source: SourceImage, baseMatte: AlphaMatte | null = null) => {
      if (releaseWorkerRef.current) finishRelease(releaseWorkerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
      revisionRef.current += 1;
      const session = {
        ...createGuidedBrushSession(source, baseMatte),
        revision: revisionRef.current,
      };
      commitState({
        status: "loading-model",
        session,
        matte: baseMatte,
        error: null,
        errorCode: null,
        progress: 0,
        lastPromptCount: null,
        lastPromptKeepCount: null,
        lastPromptRemoveCount: null,
        baseMatteRevision: baseMatte ? session.revision : null,
      });
      post({ type: "encode", revision: session.revision, source });
    },
    [commitState, finishRelease, post],
  );

  const hydrate = useCallback(
    (source: SourceImage, baseMatte: AlphaMatte | null = null) => {
      if (releaseWorkerRef.current) finishRelease(releaseWorkerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
      revisionRef.current += 1;
      const status: GuidedBrushStatus = baseMatte ? "preview" : "ready";
      const session = {
        ...createGuidedBrushSession(source, baseMatte),
        revision: revisionRef.current,
        computedRevision: baseMatte ? revisionRef.current : null,
        status,
      };
      commitState({
        status,
        session,
        matte: baseMatte,
        error: null,
        errorCode: null,
        progress: null,
        lastPromptCount: null,
        lastPromptKeepCount: null,
        lastPromptRemoveCount: null,
        baseMatteRevision: baseMatte ? session.revision : null,
      });
    },
    [commitState, finishRelease],
  );

  const replaceBase = useCallback(
    (baseMatte: AlphaMatte | null) => {
      const current = stateRef.current;
      const currentSession = current.session;
      if (!currentSession) return;
      pendingApplyRef.current?.reject(
        new Error("Cutout apply was superseded by document history"),
      );
      pendingApplyRef.current = null;
      revisionRef.current += 1;
      const session = {
        ...createGuidedBrushSession(currentSession.source, baseMatte),
        brushRadius: currentSession.brushRadius,
        revision: revisionRef.current,
        computedRevision: baseMatte ? revisionRef.current : null,
        status: baseMatte ? ("preview" as const) : ("ready" as const),
      };
      commitState({
        ...current,
        status: session.status,
        session,
        matte: baseMatte,
        error: null,
        errorCode: null,
        progress: null,
        lastPromptCount: null,
        lastPromptKeepCount: null,
        lastPromptRemoveCount: null,
        baseMatteRevision: baseMatte ? session.revision : null,
      });
    },
    [commitState],
  );

  const updateMarkings = useCallback(
    (update: (session: GuidedBrushSession) => GuidedBrushSession) => {
      const current = stateRef.current;
      if (!current.session) return;
      const updated = update(current.session);
      if (updated === current.session) return;
      revisionRef.current += 1;
      const session = {
        ...updated,
        revision: revisionRef.current,
        status: "dirty" as const,
      };
      commitState({
        ...current,
        status: "dirty",
        session,
        error: null,
        errorCode: null,
        progress: null,
      });
    },
    [commitState],
  );

  const addStroke = useCallback(
    (stroke: {
      mode: GuidedBrushMode;
      points: readonly { x: number; y: number }[];
      radius?: number;
    }) => {
      const current = stateRef.current.session;
      if (!current) return;
      updateMarkings((session) =>
        appendGuidedBrushStroke(session, {
          id: createGuidedBrushId(),
          mode: stroke.mode,
          points: stroke.points,
          radius: stroke.radius ?? current.brushRadius,
        }),
      );
      const updatedSession = stateRef.current.session;
      if (updatedSession && !workerRef.current) {
        post({
          type: "encode",
          revision: updatedSession.revision,
          source: updatedSession.source,
        });
      }
    },
    [post, updateMarkings],
  );

  const setBrushRadius = useCallback(
    (radius: number) => {
      const current = stateRef.current;
      if (!current.session) return;
      const session = setGuidedBrushRadius(current.session, radius);
      if (session !== current.session) commitState({ ...current, session });
    },
    [commitState],
  );

  const undo = useCallback(() => updateMarkings(undoGuidedBrushStroke), [updateMarkings]);
  const redo = useCallback(() => updateMarkings(redoGuidedBrushStroke), [updateMarkings]);
  const clear = useCallback(
    () => updateMarkings(clearGuidedBrushStrokes),
    [updateMarkings],
  );

  const apply = useCallback((): Promise<AlphaMatte> => {
    const pendingApply = pendingApplyRef.current;
    if (pendingApply) return pendingApply.promise;
    const current = stateRef.current;
    const session = current.session;
    if (!session || current.status === "predicting") {
      return Promise.reject(new Error("No visible Cutout change is ready to apply"));
    }
    if (!session.strokes.length) {
      if (
        session.baseMatte &&
        session.strokes.length === 0 &&
        session.computedRevision !== session.revision
      ) {
        const restored = restoreGuidedBrushBase(session);
        revisionRef.current = restored.revision;
        commitState({
          ...current,
          status: "preview",
          session: restored,
          matte: session.baseMatte,
          error: null,
          errorCode: null,
          progress: null,
          lastPromptCount: 0,
          lastPromptKeepCount: 0,
          lastPromptRemoveCount: 0,
          baseMatteRevision: restored.revision,
        });
        return Promise.resolve(session.baseMatte);
      }
      return Promise.reject(new Error("Add a brush marking before applying"));
    }
    if (!session.baseMatte && !session.strokes.some((stroke) => stroke.mode === "keep")) {
      fail(
        "Add at least one Keep marking before applying a direct selection",
        "keep-required",
      );
      return Promise.reject(
        new Error("Add at least one Keep marking before applying a direct selection"),
      );
    }
    let resolveApply!: (matte: AlphaMatte) => void;
    let rejectApply!: (error: Error) => void;
    const promise = new Promise<AlphaMatte>((resolve, reject) => {
      resolveApply = resolve;
      rejectApply = reject;
    });
    pendingApplyRef.current = {
      revision: session.revision,
      promise,
      resolve: resolveApply,
      reject: rejectApply,
    };
    const predicting = { ...session, status: "predicting" as const };
    const promptPoints = createLightweightGuidedPoints(session.strokes);
    commitState({
      ...current,
      status: "predicting",
      session: predicting,
      error: null,
      errorCode: null,
      progress: null,
      lastPromptCount: promptPoints.length,
      lastPromptKeepCount: promptPoints.filter((point) => point.label === 1).length,
      lastPromptRemoveCount: promptPoints.filter((point) => point.label === 0).length,
    });
    if (!workerRef.current) {
      post({ type: "encode", revision: session.revision, source: session.source });
    }
    post({
      type: "prompt",
      prompt: {
        revision: session.revision,
        points: promptPoints,
        box: null,
        previousMask: null,
      },
      guided: {
        strokes: session.strokes,
        width: session.source.width,
        height: session.source.height,
        baseMatte: session.baseMatte,
      },
    });
    return promise;
  }, [commitState, fail, post]);

  const cancelDraft = useCallback(() => {
    const current = stateRef.current;
    const session = current.session;
    if (!session) return;
    pendingApplyRef.current?.reject(new Error("Cutout apply was cancelled"));
    pendingApplyRef.current = null;
    const cancelled = cancelGuidedBrushDraft(session);
    if (cancelled === session) return;
    revisionRef.current = cancelled.revision;
    commitState({
      ...current,
      status: cancelled.status,
      session: cancelled,
      matte: cancelled.baseMatte,
      error: null,
      errorCode: null,
      progress: null,
      lastPromptCount: null,
      lastPromptKeepCount: null,
      lastPromptRemoveCount: null,
      baseMatteRevision: cancelled.baseMatte ? cancelled.revision : null,
    });
  }, [commitState]);

  const confirmApply = useCallback(
    (matte: AlphaMatte): boolean => {
      const current = stateRef.current;
      const session = current.session;
      if (!session) return false;
      const promoted = continueGuidedBrushFromResult(session, matte);
      if (promoted === session) return false;
      revisionRef.current = promoted.revision;
      commitState({
        ...current,
        status: "preview",
        session: promoted,
        matte,
        error: null,
        errorCode: null,
        progress: null,
        baseMatteRevision: promoted.revision,
      });
      return true;
    },
    [commitState],
  );

  const recompute = useCallback(() => {
    const current = stateRef.current;
    const session = current.session;
    if (!session || current.status === "predicting") return;
    if (!session.strokes.length) {
      if (session.baseMatte && session.strokes.length === 0) {
        const restored = restoreGuidedBrushBase(session);
        revisionRef.current = restored.revision;
        commitState({
          ...current,
          status: "preview",
          session: restored,
          matte: session.baseMatte,
          error: null,
          errorCode: null,
          progress: null,
          lastPromptCount: 0,
          lastPromptKeepCount: 0,
          lastPromptRemoveCount: 0,
          baseMatteRevision: restored.revision,
        });
        return;
      }
      fail("Add a brush marking before recomputing", "marking-required");
      return;
    }
    if (!session.baseMatte && !session.strokes.some((stroke) => stroke.mode === "keep")) {
      fail(
        "Add at least one Keep marking before recomputing a direct selection",
        "keep-required",
      );
      return;
    }
    const predicting = { ...session, status: "predicting" as const };
    const promptPoints = createLightweightGuidedPoints(session.strokes);
    commitState({
      ...current,
      status: "predicting",
      session: predicting,
      error: null,
      errorCode: null,
      progress: null,
      lastPromptCount: promptPoints.length,
      lastPromptKeepCount: promptPoints.filter((point) => point.label === 1).length,
      lastPromptRemoveCount: promptPoints.filter((point) => point.label === 0).length,
    });
    if (!workerRef.current) {
      post({ type: "encode", revision: session.revision, source: session.source });
    }
    post({
      type: "prompt",
      prompt: {
        revision: session.revision,
        points: promptPoints,
        box: null,
        previousMask: null,
      },
      guided: {
        strokes: session.strokes,
        width: session.source.width,
        height: session.source.height,
        baseMatte: session.baseMatte,
      },
    });
  }, [commitState, fail, post]);

  const selectCandidate = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const session = current.session;
      if (!session || !session.editRegion) return;
      const nextSession = selectGuidedBrushCandidate(session, id);
      const candidate = nextSession.candidates.find(
        (item) => item.id === nextSession.selectedCandidateId,
      );
      if (nextSession === session || !candidate) return;
      commitState({
        ...current,
        status: "preview",
        session: nextSession,
        matte: candidate.matte,
      });
    },
    [commitState],
  );

  const retry = useCallback(() => {
    const session = stateRef.current.session;
    if (!session) return;
    if (!workerRef.current) {
      commitState({
        ...stateRef.current,
        status: "loading-model",
        session: { ...session, status: "loading-model" },
        error: null,
        errorCode: null,
        progress: 0,
      });
      post({ type: "encode", revision: session.revision, source: session.source });
      return;
    }
    recompute();
  }, [commitState, post, recompute]);

  const reset = useCallback(() => {
    pendingApplyRef.current?.reject(new Error("Cutout session was reset"));
    pendingApplyRef.current = null;
    revisionRef.current += 1;
    workerRef.current?.postMessage({ type: "reset", revision: revisionRef.current });
    if (releaseWorkerRef.current) finishRelease(releaseWorkerRef.current);
    else workerRef.current?.terminate();
    workerRef.current = null;
    commitState(initialBrushState);
  }, [commitState, finishRelease]);

  const release = useCallback((): Promise<void> => {
    if (releasePromiseRef.current) return releasePromiseRef.current;
    const worker = workerRef.current;
    if (!worker) return Promise.resolve();
    revisionRef.current += 1;
    const promise = new Promise<void>((resolve) => {
      pendingReleaseRef.current = resolve;
    });
    releasePromiseRef.current = promise;
    releaseWorkerRef.current = worker;
    releaseTimerRef.current = setTimeout(() => finishRelease(worker), 1_500);
    try {
      worker.postMessage({ type: "dispose", revision: revisionRef.current });
    } catch {
      finishRelease(worker);
    }
    return promise;
  }, [finishRelease]);

  useEffect(
    () => () => {
      revisionRef.current += 1;
      if (releaseWorkerRef.current) finishRelease(releaseWorkerRef.current);
      else workerRef.current?.terminate();
      workerRef.current = null;
      stateRef.current = initialBrushState;
      pendingApplyRef.current?.reject(new Error("Cutout session was disposed"));
      pendingApplyRef.current = null;
      matteRef.current = null;
      baseMatteRef.current = null;
    },
    [finishRelease],
  );

  return {
    state,
    matteRef,
    baseMatteRef,
    start,
    hydrate,
    replaceBase,
    addStroke,
    setBrushRadius,
    undo,
    redo,
    clear,
    apply,
    confirmApply,
    cancelDraft,
    recompute,
    selectCandidate,
    continueFromResult,
    canAccept: state.session ? canAcceptGuidedBrushSession(state.session) : false,
    canApply: state.session ? canApplyGuidedBrushSession(state.session) : false,
    retry,
    release,
    reset,
  };
}
