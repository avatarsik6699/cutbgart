import { useCallback, useEffect, useRef, useState } from "react";

import type { InferencePath, SourceImage } from "../../../entities/processed-image";
import { createBenchmarkExport, downloadBenchmarkExport } from "./benchmark-export";
import { EVALUATION_MODELS } from "./model-registry";
import type {
  BenchmarkExport,
  BenchmarkPreference,
  EvaluationModelId,
  LabImage,
  ModelLabCapabilities,
  ModelLabState,
  ModelLabWorkerRequest,
  ModelLabWorkerResponse,
} from "./types";

interface NavigatorDeviceMemory {
  readonly deviceMemory?: number;
}

type PendingOutcome =
  | { type: "result"; response: Extract<ModelLabWorkerResponse, { type: "result" }> }
  | { type: "error"; response: Extract<ModelLabWorkerResponse, { type: "error" }> }
  | { type: "cancelled" };

interface PendingRequest {
  resolve: (outcome: PendingOutcome) => void;
}

const DEFAULT_MODEL_IDS = EVALUATION_MODELS.map(({ id }) => id);

function initialState(): ModelLabState {
  return {
    status: "idle",
    images: [],
    selectedModelIds: [...DEFAULT_MODEL_IDS],
    results: [],
    measurements: [],
    preferences: [],
    progress: { completed: 0, total: 0 },
  };
}

async function requestedInferencePath(): Promise<InferencePath> {
  if (typeof navigator === "undefined" || !navigator.gpu) return "wasm";
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter?.features.has("shader-f16") ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

async function collectCapabilities(): Promise<ModelLabCapabilities> {
  const nav = navigator as Navigator & NavigatorDeviceMemory;
  return {
    requestedPath: await requestedInferencePath(),
    userAgent: navigator.userAgent,
    hardwareConcurrency:
      typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : null,
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
  };
}

async function sourceFromFile(file: File): Promise<SourceImage> {
  if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
    throw new Error(`Неподдерживаемый формат: ${file.type || "неизвестный"}`);
  }
  const bitmap = await createImageBitmap(file);
  try {
    return {
      blob: file,
      width: bitmap.width,
      height: bitmap.height,
      format: file.type as SourceImage["format"],
    };
  } finally {
    bitmap.close();
  }
}

export function useModelLab() {
  const [state, setState] = useState<ModelLabState>(initialState);
  const [capabilities, setCapabilities] = useState<ModelLabCapabilities | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const objectUrlsRef = useRef(new Set<string>());
  const runTokenRef = useRef(0);
  const requestCounterRef = useRef(0);

  const revokeObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current.clear();
  }, []);

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    for (const pending of pendingRef.current.values()) {
      pending.resolve({ type: "cancelled" });
    }
    pendingRef.current.clear();
  }, []);

  useEffect(() => {
    let active = true;
    void collectCapabilities().then((value) => {
      if (active) setCapabilities(value);
    });
    return () => {
      active = false;
      stopWorker();
      revokeObjectUrls();
    };
  }, [revokeObjectUrls, stopWorker]);

  const handleWorkerMessage = useCallback((message: ModelLabWorkerResponse) => {
    if (message.type === "progress") {
      setState((current) => ({
        ...current,
        current: {
          imageOrdinal: current.current?.imageOrdinal ?? 0,
          modelId: message.modelId,
          stage: message.stage,
          percent: message.percent,
        },
      }));
      return;
    }
    const pending = pendingRef.current.get(message.requestId);
    if (!pending) return;
    pendingRef.current.delete(message.requestId);
    if (message.type === "result") {
      pending.resolve({ type: "result", response: message });
    } else {
      pending.resolve({ type: "error", response: message });
    }
  }, []);

  const getWorker = useCallback(() => {
    let worker = workerRef.current;
    if (!worker) {
      worker = new Worker(new URL("../worker/model-lab.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener(
        "message",
        (event: MessageEvent<ModelLabWorkerResponse>) => {
          handleWorkerMessage(event.data);
        },
      );
      workerRef.current = worker;
    }
    return worker;
  }, [handleWorkerMessage]);

  const selectFiles = useCallback(
    async (files: File[]) => {
      runTokenRef.current += 1;
      stopWorker();
      revokeObjectUrls();
      try {
        const images: LabImage[] = [];
        for (const [index, file] of files.entries()) {
          const source = await sourceFromFile(file);
          const sourceUrl = URL.createObjectURL(source.blob);
          objectUrlsRef.current.add(sourceUrl);
          images.push({
            id: `image-${String(index + 1)}`,
            ordinal: index + 1,
            source,
            sourceUrl,
          });
        }
        setState((current) => ({
          ...initialState(),
          selectedModelIds: current.selectedModelIds,
          status: images.length > 0 ? "ready" : "idle",
          images,
        }));
      } catch (error) {
        revokeObjectUrls();
        setState((current) => ({
          ...current,
          status: "idle",
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [revokeObjectUrls, stopWorker],
  );

  const setModelSelected = useCallback(
    (modelId: EvaluationModelId, selected: boolean) => {
      setState((current) => {
        const selectedModelIds = selected
          ? [...new Set([...current.selectedModelIds, modelId])]
          : current.selectedModelIds.filter((id) => id !== modelId);
        return { ...current, selectedModelIds };
      });
    },
    [],
  );

  const processOne = useCallback(
    (
      image: LabImage,
      modelId: EvaluationModelId,
      inferencePath: InferencePath,
    ): Promise<PendingOutcome> => {
      const requestId = `lab-${String(++requestCounterRef.current)}`;
      return new Promise((resolve) => {
        pendingRef.current.set(requestId, { resolve });
        getWorker().postMessage({
          type: "process",
          requestId,
          modelId,
          inferencePath,
          source: image.source,
          imageOrdinal: image.ordinal,
        } satisfies ModelLabWorkerRequest);
      });
    },
    [getWorker],
  );

  const runComparison = useCallback(async () => {
    if (
      state.status === "running" ||
      state.images.length === 0 ||
      state.selectedModelIds.length === 0
    ) {
      return;
    }
    const runToken = ++runTokenRef.current;
    const currentCapabilities = capabilities ?? (await collectCapabilities());
    if (!capabilities) setCapabilities(currentCapabilities);
    const total = state.images.length * state.selectedModelIds.length;
    for (const result of state.results) {
      URL.revokeObjectURL(result.resultUrl);
      objectUrlsRef.current.delete(result.resultUrl);
    }
    setState((current) => ({
      ...current,
      status: "running",
      results: [],
      measurements: [],
      preferences: [],
      progress: { completed: 0, total },
      error: undefined,
    }));

    let completed = 0;
    for (const modelId of state.selectedModelIds) {
      for (const image of state.images) {
        if (runTokenRef.current !== runToken) return;
        setState((current) => ({
          ...current,
          current: {
            imageOrdinal: image.ordinal,
            modelId,
            stage: "loading",
            percent: null,
          },
        }));
        const outcome = await processOne(
          image,
          modelId,
          currentCapabilities.requestedPath,
        );
        if (outcome.type === "cancelled" || runTokenRef.current !== runToken) return;
        completed += 1;
        if (outcome.type === "result") {
          const resultUrl = URL.createObjectURL(outcome.response.result);
          objectUrlsRef.current.add(resultUrl);
          setState((current) => ({
            ...current,
            results: [
              ...current.results,
              {
                imageOrdinal: image.ordinal,
                modelId,
                result: outcome.response.result,
                resultUrl,
                measurement: outcome.response.measurement,
              },
            ],
            measurements: [...current.measurements, outcome.response.measurement],
            progress: { completed, total },
          }));
        } else {
          setState((current) => ({
            ...current,
            measurements: [...current.measurements, outcome.response.measurement],
            progress: { completed, total },
          }));
        }
      }
    }
    if (runTokenRef.current === runToken) {
      setState((current) => ({
        ...current,
        status: "complete",
        current: undefined,
      }));
    }
  }, [capabilities, processOne, state]);

  const cancel = useCallback(() => {
    runTokenRef.current += 1;
    stopWorker();
    setState((current) => ({ ...current, status: "cancelled", current: undefined }));
  }, [stopWorker]);

  const reset = useCallback(() => {
    runTokenRef.current += 1;
    stopWorker();
    revokeObjectUrls();
    setState(initialState());
  }, [revokeObjectUrls, stopWorker]);

  const setPreference = useCallback((preference: BenchmarkPreference) => {
    setState((current) => ({
      ...current,
      preferences: [
        ...current.preferences.filter(
          ({ imageOrdinal }) => imageOrdinal !== preference.imageOrdinal,
        ),
        preference,
      ],
    }));
  }, []);

  const buildExport = useCallback((): BenchmarkExport | null => {
    if (!capabilities) return null;
    return createBenchmarkExport({
      capabilities,
      selectedModelIds: state.selectedModelIds,
      imageCount: state.images.length,
      measurements: state.measurements,
      preferences: state.preferences,
    });
  }, [capabilities, state]);

  const downloadExport = useCallback(() => {
    const value = buildExport();
    if (value) downloadBenchmarkExport(value);
  }, [buildExport]);

  return {
    state,
    capabilities,
    selectFiles,
    setModelSelected,
    runComparison,
    cancel,
    reset,
    setPreference,
    buildExport,
    downloadExport,
  };
}
