import { useCallback, useEffect, useRef, useState } from "react";

import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
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

export function useObjectSelection(
  workerFactory = () =>
    new Worker(new URL("../worker/select-object.worker.ts", import.meta.url), {
      type: "module",
    }),
) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const matteRef = useRef<AlphaMatte | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const revisionRef = useRef(0);

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
    reset,
  };
}
