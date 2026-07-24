import { useCallback, useEffect, useRef, useState } from "react";

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
type InteractiveOutcome = InteractiveResponse | { type: "cancelled" };

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
    progress: { completed: 0, total: 0 },
  };
}

export function useInteractiveMattingLab() {
  const [state, setState] = useState<InteractiveState>(initialState);
  const [capabilities, setCapabilities] = useState<ModelLabCapabilities | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, (response: InteractiveOutcome) => void>());
  const runTokenRef = useRef(0);
  const requestCounterRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    for (const resolve of pendingRef.current.values()) resolve({ type: "cancelled" });
    pendingRef.current.clear();
  }, []);

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
      stopWorker();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, [stopWorker]);

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
    const resolve = pendingRef.current.get(message.requestId);
    if (!resolve) return;
    pendingRef.current.delete(message.requestId);
    resolve(message);
  }, []);

  const getWorker = useCallback(() => {
    let worker = workerRef.current;
    if (!worker) {
      worker = new Worker(new URL("../worker/model-lab.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener(
        "message",
        (event: MessageEvent<ModelLabAnyWorkerResponse>) => {
          handleMessage(event.data);
        },
      );
      workerRef.current = worker;
    }
    return worker;
  }, [handleMessage]);

  const setOptedIn = useCallback(
    (optedIn: boolean) => {
      if (!optedIn) {
        runTokenRef.current += 1;
        stopWorker();
      }
      setState((current) => ({ ...current, optedIn }));
    },
    [stopWorker],
  );

  const loadSyntheticCorpus = useCallback(async () => {
    if (!state.optedIn || state.status === "running") return;
    revokeCases(state.cases);
    try {
      const cases = await createSyntheticMattingCorpus();
      for (const item of cases) objectUrlsRef.current.add(item.sourceUrl);
      setState((current) => ({
        ...current,
        cases,
        status: "ready",
        runtime: [],
        quality: [],
        previews: [],
        progress: { completed: 0, total: 0 },
        error: undefined,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [revokeCases, state.cases, state.optedIn, state.status]);

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
      const requestId = `matting-${String(++requestCounterRef.current)}`;
      return new Promise<InteractiveOutcome>((resolve) => {
        pendingRef.current.set(requestId, resolve);
        getWorker().postMessage({
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
    [getWorker],
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
    stopWorker();
    setState((current) => ({ ...current, status: "cancelled", current: undefined }));
  }, [stopWorker]);

  const reset = useCallback(() => {
    runTokenRef.current += 1;
    stopWorker();
    revokeCases(state.cases);
    revokePreviews(state.previews);
    setState(initialState());
    setCapabilities(null);
  }, [revokeCases, revokePreviews, state.cases, state.previews, stopWorker]);

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
