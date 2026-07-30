import { useCallback, useState } from "react";

import { useWorkerLifecycle } from "@/shared/lib/use-worker-lifecycle";
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

  const handleMessage = useCallback(function handleMessage(
    message: MatteRefinementWorkerResponse,
  ) {
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
  }, []);

  const worker = useWorkerLifecycle<MatteRefinementWorkerResponse>(
    workerFactory,
    handleMessage,
  );

  // Deliberately does not cancel a previous active request first — unlike
  // `useForegroundRefinement.start`, this hook has never auto-cancelled an
  // in-flight refinement when a new one starts (preserved from the
  // pre-extraction implementation).
  const start = useCallback(
    function start(input: StartMatteRefinementInput) {
      const requestId = worker.nextRequestId("matte");
      worker.setActiveRequest(requestId);
      setState({ ...initialState, status: "preparing" });
      try {
        const trimap = buildRefinementTrimap({
          automaticMatte: input.priorMatte,
          guidedMatte: input.guidedMatte ?? null,
          constraints: input.constraints ?? null,
        });
        const crop = computeRefinementCrop(trimap);
        if (!crop) {
          setState({
            ...initialState,
            status: "applying",
            result: {
              matte: deterministicRefinement({
                priorMatte: input.priorMatte,
                guidedMatte: input.guidedMatte ?? null,
                trimap,
                constraints: input.constraints ?? null,
              }),
              requestedMode: input.mode,
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
          source: input.source,
          priorMatte: input.priorMatte,
          guidedMatte: input.guidedMatte ?? null,
          constraints: input.constraints ?? null,
          trimap,
          crop,
          inputSize: computeMattingInputSize(crop),
          requestedMode: input.mode,
          requestedPath: input.path,
        };
        worker.getWorker().postMessage({ type: "refine", request });
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
