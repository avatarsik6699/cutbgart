import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AlphaMatte,
  RefinementConstraintMap,
  SourceImage,
} from "../../../entities/processed-image";
import type {
  ForegroundRefinementError,
  ForegroundRefinementResult,
  ForegroundRefinementStatus,
  ForegroundRefinementWorkerResponse,
} from "./types";

export interface ForegroundRefinementState {
  status: ForegroundRefinementStatus;
  progress: number | null;
  result: ForegroundRefinementResult | null;
  error: ForegroundRefinementError | null;
  fallbackReason: string | null;
}

const initialState: ForegroundRefinementState = {
  status: "idle",
  progress: null,
  result: null,
  error: null,
  fallbackReason: null,
};

export interface StartForegroundRefinementInput {
  source: SourceImage;
  matte: AlphaMatte;
  constraints?: RefinementConstraintMap | null;
  componentCleanup?: boolean;
}

export function useForegroundRefinement(
  workerFactory = () =>
    new Worker(new URL("../worker/refine-foreground.worker.ts", import.meta.url), {
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
      (event: MessageEvent<ForegroundRefinementWorkerResponse>) => {
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
            status: "refining",
            progress: message.percent,
          }));
        } else if (message.type === "fallback") {
          setState((current) => ({
            ...current,
            status: "fallback",
            progress: null,
            fallbackReason: message.reason,
          }));
        } else if (message.type === "result") {
          setState((current) => ({
            ...current,
            status: "applying",
            progress: null,
            result: message.result,
            error: null,
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
      matte,
      constraints = null,
      componentCleanup = true,
    }: StartForegroundRefinementInput) => {
      const worker = getWorker();
      const previousRequest = activeRequestRef.current;
      if (previousRequest)
        worker.postMessage({ type: "cancel", requestId: previousRequest });
      requestCounterRef.current += 1;
      const requestId = `foreground-${String(requestCounterRef.current)}`;
      activeRequestRef.current = requestId;
      setState({ ...initialState, status: "preparing" });
      worker.postMessage({
        type: "refine-foreground",
        request: { requestId, source, matte, constraints, componentCleanup },
      });
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
    const requestId = `dispose-foreground-${String(requestCounterRef.current)}`;
    return new Promise((resolve) => {
      pendingDisposeRef.current.set(requestId, resolve);
      worker.postMessage({ type: "dispose", requestId });
    });
  }, []);

  const reset = useCallback(() => {
    const requestId = activeRequestRef.current;
    if (requestId) workerRef.current?.postMessage({ type: "cancel", requestId });
    activeRequestRef.current = null;
    setState(initialState);
    workerRef.current?.terminate();
    workerRef.current = null;
    for (const resolve of pendingDisposeRef.current.values()) resolve();
    pendingDisposeRef.current.clear();
  }, []);

  useEffect(() => reset, [reset]);
  return { state, start, cancel, prepareNext, finishApplying, release, reset };
}
