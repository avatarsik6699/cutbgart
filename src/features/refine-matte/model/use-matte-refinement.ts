import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AlphaMatte,
  InferencePath,
  RefinementConstraintMap,
  SourceImage,
} from "../../../entities/processed-image";
import { deterministicRefinement } from "./deterministic-fusion";
import { computeMattingInputSize, computeRefinementCrop } from "./focus-crop";
import { buildRefinementTrimap } from "./trimap";
import type {
  MatteRefinementRequest,
  MatteRefinementWorkerResponse,
  MattingRefinementError,
  MattingFallback,
  MattingRefinementMode,
  MattingRefinementResult,
  MattingRefinementStatus,
} from "./types";

export interface MatteRefinementState {
  status: MattingRefinementStatus;
  progress: number | null;
  result: MattingRefinementResult | null;
  error: MattingRefinementError | null;
  fallbackReason: string | null;
  fallback: MattingFallback | null;
}

const initialState: MatteRefinementState = {
  status: "idle",
  progress: null,
  result: null,
  error: null,
  fallbackReason: null,
  fallback: null,
};

export interface StartMatteRefinementInput {
  source: SourceImage;
  priorMatte: AlphaMatte;
  guidedMatte?: AlphaMatte | null;
  constraints?: RefinementConstraintMap | null;
  mode: MattingRefinementMode;
  path: InferencePath;
}

export function useMatteRefinement(
  workerFactory = () =>
    new Worker(new URL("../worker/refine-matte.worker.ts", import.meta.url), {
      type: "module",
    }),
) {
  const [state, setState] = useState(initialState);
  const workerRef = useRef<Worker | null>(null);
  const requestCounterRef = useRef(0);
  const activeRequestRef = useRef<string | null>(null);
  const pendingDisposeRef = useRef(new Map<string, () => void>());

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = workerFactory();
    worker.addEventListener(
      "message",
      (event: MessageEvent<MatteRefinementWorkerResponse>) => {
        const message = event.data;
        if (message.type === "disposed") {
          pendingDisposeRef.current.get(message.requestId)?.();
          pendingDisposeRef.current.delete(message.requestId);
          return;
        }
        if (message.requestId !== activeRequestRef.current) return;
        if (message.type === "progress") {
          setState((current) => ({
            ...current,
            status: message.stage === "loading" ? "loading-model" : "refining",
            progress: message.percent,
          }));
        } else if (message.type === "fallback") {
          setState((current) => ({
            ...current,
            status: "fallback",
            progress: null,
            fallbackReason: message.reason,
            fallback: message.from === "maximum" ? "balanced" : "wasm",
          }));
        } else if (message.type === "result") {
          setState((current) => ({
            ...current,
            status: "applying",
            progress: null,
            result: message.result,
            error: null,
            fallback: message.result.fallback,
            fallbackReason: message.result.fallbackReason ?? current.fallbackReason,
          }));
        } else if (message.type === "error") {
          setState((current) => ({
            ...current,
            status: "error",
            progress: null,
            error: message.error,
          }));
        }
      },
    );
    workerRef.current = worker;
    return worker;
  }, [workerFactory]);

  const start = useCallback(
    ({
      source,
      priorMatte,
      guidedMatte = null,
      constraints = null,
      mode,
      path,
    }: StartMatteRefinementInput) => {
      requestCounterRef.current += 1;
      const requestId = `matte-${String(requestCounterRef.current)}`;
      activeRequestRef.current = requestId;
      setState({ ...initialState, status: "preparing" });
      try {
        const trimap = buildRefinementTrimap({
          automaticMatte: priorMatte,
          guidedMatte,
          constraints,
        });
        const crop = computeRefinementCrop(trimap);
        if (!crop) {
          setState({
            ...initialState,
            status: "applying",
            result: {
              matte: deterministicRefinement({
                priorMatte,
                guidedMatte,
                trimap,
                constraints,
              }),
              requestedMode: mode,
              actualMode: "deterministic",
              actualPath: null,
              inputSize: { width: 0, height: 0 },
              fallback: "deterministic",
            },
            fallback: "deterministic",
          });
          return;
        }
        const request: MatteRefinementRequest = {
          requestId,
          source,
          priorMatte,
          guidedMatte,
          constraints,
          trimap,
          crop,
          inputSize: computeMattingInputSize(crop),
          requestedMode: mode,
          requestedPath: path,
        };
        getWorker().postMessage({ type: "refine", request });
      } catch (error) {
        setState({
          ...initialState,
          status: "error",
          error: {
            code: "invalid-input",
            message: error instanceof Error ? error.message : String(error),
            recoverable: false,
          },
        });
      }
    },
    [getWorker],
  );

  const cancel = useCallback(() => {
    const requestId = activeRequestRef.current;
    if (requestId) workerRef.current?.postMessage({ type: "cancel", requestId });
    activeRequestRef.current = null;
    setState(initialState);
  }, []);

  const prepareNext = useCallback(() => {
    setState({ ...initialState, status: "preparing" });
  }, []);

  const finishApplying = useCallback(() => {
    setState((current) =>
      current.status === "applying" && current.result
        ? { ...current, status: "result" }
        : current,
    );
  }, []);

  const release = useCallback((): Promise<void> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve();
    requestCounterRef.current += 1;
    const requestId = `dispose-${String(requestCounterRef.current)}`;
    return new Promise((resolve) => {
      pendingDisposeRef.current.set(requestId, resolve);
      worker.postMessage({ type: "dispose", requestId });
    });
  }, []);

  const reset = useCallback(() => {
    cancel();
    workerRef.current?.terminate();
    workerRef.current = null;
    for (const resolve of pendingDisposeRef.current.values()) resolve();
    pendingDisposeRef.current.clear();
  }, [cancel]);

  useEffect(() => reset, [reset]);
  return { state, start, cancel, prepareNext, finishApplying, release, reset };
}
