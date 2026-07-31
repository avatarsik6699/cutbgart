import { useCallback, useEffect, useRef, useState } from "react";

import { usePendingRequestWorker } from "@/shared/lib/use-pending-request-worker";
import type { InferencePath } from "../../../entities/processed-image";
import {
  createInteractiveBenchmarkExport,
  downloadInteractiveBenchmarkExport,
} from "./benchmark-export";
import { createSyntheticMattingCorpus } from "./matting-corpus";
import { measureMattingQuality } from "./matting-quality";
import {
  INTERACTIVE_EVALUATION_MODELS,
  getInteractiveEvaluationModel,
} from "./model-registry";
import type {
  InteractiveEvaluationModelId,
  InteractiveMattingBenchmarkExport,
  InteractiveRuntimeMeasurement,
  MattingCorpusCase,
  MattingQualityMeasurement,
  ModelLabAnyWorkerResponse,
  ModelLabCapabilities,
  ModelLabWorkerRequest,
} from "./types";
import { collectCapabilities } from "./use-model-lab";

type InteractiveResponse = Extract<
  ModelLabAnyWorkerResponse,
  { type: "interactive-result" | "interactive-error" }
>;
type InteractiveOutcome =
  | InteractiveResponse
  | { type: "cancelled" }
  // A hard worker crash never posts a "interactive-result"/"interactive-error"
  // message — PHASE_31 T8 full-inventory finding.
  | { type: "worker-crashed" };

interface InteractiveState {
  status: "idle" | "ready" | "running" | "complete" | "cancelled";
  optedIn: boolean;
  cases: MattingCorpusCase[];
  selectedModelIds: InteractiveEvaluationModelId[];
  runtime: InteractiveRuntimeMeasurement[];
  quality: MattingQualityMeasurement[];
  previews: Array<{
    caseOrdinal: number;
    modelId: InteractiveEvaluationModelId;
    resultUrl: string;
  }>;
  decision: InteractiveEvaluationModelId | "none";
  corpusLoading: boolean;
  progress: { completed: number; total: number };
  current?: {
    caseOrdinal: number;
    modelId: InteractiveEvaluationModelId;
    stage: "loading" | "processing";
    percent: number | null;
  };
  error?: string;
}

const DEFAULT_MODEL_IDS = INTERACTIVE_EVALUATION_MODELS.filter(
  ({ family, eligibility }) =>
    family === "matting" && eligibility === "production-eligible",
).map(({ id }) => id);

function initialState(): InteractiveState {
  return {
    status: "idle",
    optedIn: false,
    cases: [],
    selectedModelIds: [...DEFAULT_MODEL_IDS],
    runtime: [],
    quality: [],
    previews: [],
    decision: "none",
    corpusLoading: false,
    progress: { completed: 0, total: 0 },
  };
}

export function useInteractiveMattingLab() {
  const [state, setState] = useState<InteractiveState>(initialState);
  const [capabilities, setCapabilities] = useState<ModelLabCapabilities | null>(null);
  const runTokenRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());

  const resolvePendingRef = useRef<
    (requestId: string, outcome: InteractiveOutcome) => boolean
  >(() => false);

  const handleMessage = useCallback((message: ModelLabAnyWorkerResponse) => {
    if (message.type === "interactive-progress") {
      setState((current) => ({
        ...current,
        current: {
          caseOrdinal: current.current?.caseOrdinal ?? 0,
          modelId: message.modelId,
          stage: message.stage,
          percent: message.percent,
        },
      }));
      return;
    }
    if (message.type !== "interactive-result" && message.type !== "interactive-error") {
      return;
    }
    resolvePendingRef.current(message.requestId, message);
  }, []);

  const worker = usePendingRequestWorker<ModelLabAnyWorkerResponse, InteractiveOutcome>(
    useCallback(
      () =>
        new Worker(new URL("../worker/model-lab.worker.ts", import.meta.url), {
          type: "module",
        }),
      [],
    ),
    handleMessage,
    useCallback(() => ({ type: "cancelled" }) as const, []),
    useCallback(() => ({ type: "worker-crashed" }) as const, []),
  );
  resolvePendingRef.current = worker.resolvePending;

  const revokeCases = useCallback((cases: MattingCorpusCase[]) => {
    for (const item of cases) {
      URL.revokeObjectURL(item.sourceUrl);
      objectUrlsRef.current.delete(item.sourceUrl);
    }
  }, []);

  const revokePreviews = useCallback((previews: InteractiveState["previews"]) => {
    for (const item of previews) {
      URL.revokeObjectURL(item.resultUrl);
      objectUrlsRef.current.delete(item.resultUrl);
    }
  }, []);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      worker.stopWorker();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, [worker]);

  const setOptedIn = useCallback(
    (optedIn: boolean) => {
      if (!optedIn) {
        runTokenRef.current += 1;
        worker.stopWorker();
      }
      setState((current) => ({ ...current, optedIn }));
    },
    [worker],
  );

  const loadSyntheticCorpus = useCallback(async () => {
    if (!state.optedIn || state.status === "running" || state.corpusLoading) return;
    revokeCases(state.cases);
    setState((current) => ({ ...current, corpusLoading: true }));
    try {
      const cases = await createSyntheticMattingCorpus();
      for (const item of cases) objectUrlsRef.current.add(item.sourceUrl);
      setState((current) => ({
        ...current,
        cases,
        status: "ready",
        corpusLoading: false,
        runtime: [],
        quality: [],
        previews: [],
        progress: { completed: 0, total: 0 },
        error: undefined,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        corpusLoading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [revokeCases, state.cases, state.corpusLoading, state.optedIn, state.status]);

  const setModelSelected = useCallback(
    (modelId: InteractiveEvaluationModelId, selected: boolean) => {
      setState((current) => ({
        ...current,
        selectedModelIds: selected
          ? [...new Set([...current.selectedModelIds, modelId])]
          : current.selectedModelIds.filter((id) => id !== modelId),
      }));
    },
    [],
  );

  const processOne = useCallback(
    (
      item: MattingCorpusCase,
      modelId: InteractiveEvaluationModelId,
      inferencePath: InferencePath,
    ) => {
      const requestId = worker.nextRequestId("matting");
      return new Promise<InteractiveOutcome>((resolve) => {
        worker.registerPending(requestId, resolve);
        worker.getWorker().postMessage({
          type: "process-interactive",
          requestId,
          modelId,
          inferencePath,
          source: item.source,
          trimap: item.trimap,
          caseOrdinal: item.ordinal,
        } satisfies ModelLabWorkerRequest);
      });
    },
    [worker],
  );

  const run = useCallback(async () => {
    if (
      !state.optedIn ||
      state.status === "running" ||
      state.cases.length === 0 ||
      state.selectedModelIds.length === 0
    ) {
      return;
    }
    const runToken = ++runTokenRef.current;
    const currentCapabilities = capabilities ?? (await collectCapabilities());
    if (!capabilities) setCapabilities(currentCapabilities);
    const total = state.cases.length * state.selectedModelIds.length;
    revokePreviews(state.previews);
    setState((current) => ({
      ...current,
      status: "running",
      runtime: [],
      quality: [],
      previews: [],
      progress: { completed: 0, total },
      error: undefined,
    }));

    let completed = 0;
    for (const modelId of state.selectedModelIds) {
      for (const item of state.cases) {
        if (runTokenRef.current !== runToken) return;
        setState((current) => ({
          ...current,
          current: {
            caseOrdinal: item.ordinal,
            modelId,
            stage: "loading",
            percent: null,
          },
        }));
        const response = await processOne(
          item,
          modelId,
          currentCapabilities.requestedPath,
        );
        if (response.type === "worker-crashed") {
          setState((current) => ({
            ...current,
            status: "cancelled",
            current: undefined,
            error: "The matting worker crashed unexpectedly. You can run again.",
          }));
          return;
        }
        if (response.type === "cancelled" || runTokenRef.current !== runToken) return;
        completed += 1;
        const quality =
          response.type === "interactive-result"
            ? measureMattingQuality({
                caseOrdinal: item.ordinal,
                modelId,
                predicted: response.matte,
                expected: item.groundTruth,
              })
            : null;
        const preview =
          response.type === "interactive-result"
            ? {
                caseOrdinal: item.ordinal,
                modelId,
                resultUrl: URL.createObjectURL(response.result),
              }
            : null;
        if (preview) objectUrlsRef.current.add(preview.resultUrl);
        setState((current) => ({
          ...current,
          runtime: [...current.runtime, response.measurement],
          quality: quality ? [...current.quality, quality] : current.quality,
          previews: preview ? [...current.previews, preview] : current.previews,
          progress: { completed, total },
        }));
      }
    }
    if (runTokenRef.current === runToken) {
      setState((current) => ({ ...current, status: "complete", current: undefined }));
    }
  }, [capabilities, processOne, revokePreviews, state]);

  const cancel = useCallback(() => {
    runTokenRef.current += 1;
    worker.stopWorker();
    setState((current) => ({ ...current, status: "cancelled", current: undefined }));
  }, [worker]);

  const reset = useCallback(() => {
    runTokenRef.current += 1;
    worker.stopWorker();
    revokeCases(state.cases);
    revokePreviews(state.previews);
    setState(initialState());
    setCapabilities(null);
  }, [revokeCases, revokePreviews, state.cases, state.previews, worker]);

  const setDecision = useCallback((decision: InteractiveEvaluationModelId | "none") => {
    setState((current) => ({ ...current, decision }));
  }, []);

  const buildExport = useCallback((): InteractiveMattingBenchmarkExport | null => {
    if (!capabilities) return null;
    return createInteractiveBenchmarkExport({
      capabilities,
      selectedModelIds: state.selectedModelIds,
      corpusCaseCount: state.cases.length,
      quality: state.quality,
      runtime: state.runtime,
      decision: state.decision,
    });
  }, [capabilities, state]);

  const downloadExport = useCallback(() => {
    const value = buildExport();
    if (value) downloadInteractiveBenchmarkExport(value);
  }, [buildExport]);

  return {
    state,
    capabilities,
    setOptedIn,
    loadSyntheticCorpus,
    setModelSelected,
    run,
    cancel,
    reset,
    setDecision,
    buildExport,
    downloadExport,
    getProfile: getInteractiveEvaluationModel,
  };
}
