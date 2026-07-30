import { useCallback, useState } from "react";

import { useWorkerLifecycle } from "@/shared/lib/use-worker-lifecycle";
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

  const handleMessage = useCallback(function handleMessage(
    message: ForegroundRefinementWorkerResponse,
  ) {
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
  }, []);

  const worker = useWorkerLifecycle<ForegroundRefinementWorkerResponse>(
    workerFactory,
    handleMessage,
  );

  const start = useCallback(
    function start(input: StartForegroundRefinementInput) {
      const activeWorker = worker.getWorker();
      worker.cancelActive();
      const requestId = worker.nextRequestId("foreground");
      worker.setActiveRequest(requestId);
      setState({ ...initialState, status: "preparing" });
      activeWorker.postMessage({
        type: "refine-foreground",
        request: {
          requestId,
          source: input.source,
          matte: input.matte,
          constraints: input.constraints ?? null,
          componentCleanup: input.componentCleanup ?? true,
        },
      });
    },
    [worker],
  );

  const cancel = useCallback(
    function cancel() {
      worker.cancelActive();
      setState(initialState);
    },
    [worker],
  );

  const prepareNext = useCallback(function prepareNext() {
    setState({ ...initialState, status: "preparing" });
  }, []);

  const finishApplying = useCallback(function finishApplying() {
    setState((current) =>
      current.status === "applying" && current.result
        ? { ...current, status: "result" }
        : current,
    );
  }, []);

  const reset = useCallback(
    function reset() {
      worker.terminate();
      setState(initialState);
    },
    [worker],
  );

  return {
    state,
    start,
    cancel,
    prepareNext,
    finishApplying,
    release: worker.release,
    reset,
  };
}
