import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AlphaMatte,
  InferencePath,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";
import {
  deriveBatchSchedulerSnapshot,
  type BatchItem,
  type BatchSession,
  type ModelLoadProgress,
} from "./types";

type BatchWorkerRequest =
  | { type: "load-model"; qualityMode: QualityMode; inferencePath: InferencePath }
  | {
      type: "process";
      requestId: string;
      qualityMode: QualityMode;
      inferencePath: InferencePath;
      source: SourceImage;
    }
  | { type: "extract-alpha-matte"; requestId: string; result: Blob }
  | { type: "recomposite"; requestId: string; image: ProcessedImage; matte: AlphaMatte };
type BatchWorkerResponse =
  | {
      type: "model-progress";
      qualityMode: QualityMode;
      percent: number;
      loaded: number;
      total: number;
    }
  | {
      type: "model-ready";
      qualityMode: QualityMode;
      inferencePath: InferencePath;
      dtype: string;
    }
  | { type: "process-result"; requestId: string; result: Blob; durationMs: number }
  | {
      type: "alpha-matte-result";
      requestId: string;
      matte: AlphaMatte;
      durationMs: number;
    }
  | {
      type: "recomposite-result";
      requestId: string;
      result: ProcessedImage;
      durationMs: number;
    }
  | { type: "error"; requestId?: string; message: string; code: string }
  | { type: "log"; qualityMode: QualityMode; message: string }
  | { type: "fallback-to-wasm"; qualityMode: QualityMode };

export interface BatchUpload {
  fileName: string;
  source: SourceImage;
}

export interface UseBatchProcessingOptions {
  qualityMode: QualityMode;
  inferencePath: InferencePath;
  concurrencyLimit?: 1 | 2;
  workerFactory?: () => Worker;
}

const emptySession: BatchSession = { items: [], selectedItemId: null, modelLoads: {} };

function createInferenceWorker(): Worker {
  return new Worker(
    new URL("../../remove-background/worker/inference.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
}

export function useBatchProcessing({
  qualityMode,
  inferencePath,
  concurrencyLimit = inferencePath === "webgpu" ? 2 : 1,
  workerFactory = createInferenceWorker,
}: UseBatchProcessingOptions) {
  const [session, setSession] = useState<BatchSession>(emptySession);
  const workerRef = useRef<Worker | null>(null);
  const modelReadyRef = useRef(false);
  const loadingRef = useRef(false);
  const activeRef = useRef(new Set<string>());
  const queueRef = useRef<string[]>([]);
  const workRef = useRef(
    new Map<string, { qualityMode: QualityMode; source: SourceImage }>(),
  );
  const pendingMattesRef = useRef(
    new Map<
      string,
      { resolve: (matte: AlphaMatte) => void; reject: (error: Error) => void }
    >(),
  );
  const pendingCompositesRef = useRef(
    new Map<
      string,
      { resolve: (image: ProcessedImage) => void; reject: (error: Error) => void }
    >(),
  );

  const updateItem = useCallback((id: string, update: (item: BatchItem) => BatchItem) => {
    setSession((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? update(item) : item)),
    }));
  }, []);

  const dispatchQueued = useCallback(() => {
    const worker = workerRef.current;
    if (!modelReadyRef.current || !worker) return;
    const available = concurrencyLimit - activeRef.current.size;
    if (available <= 0) return;
    const queuedIds = queueRef.current.splice(0, available);
    if (!queuedIds.length) return;
    const started = performance.now();
    for (const id of queuedIds) {
      const work = workRef.current.get(id);
      if (!work) continue;
      activeRef.current.add(id);
      worker.postMessage({
        type: "process",
        requestId: id,
        qualityMode: work.qualityMode,
        inferencePath,
        source: work.source,
      } satisfies BatchWorkerRequest);
    }
    setSession((current) => ({
      ...current,
      items: current.items.map((item) =>
        queuedIds.includes(item.id)
          ? {
              ...item,
              status: "processing",
              startedAt: started,
              processingProgress: {
                stage: "inference",
                startedAt: started,
                elapsedMs: 0,
                percent: null,
              },
            }
          : item,
      ),
    }));
  }, [concurrencyLimit, inferencePath]);

  const batchStarted = session.items.length > 0;

  useEffect(() => {
    if (!batchStarted) return;
    const worker = workerFactory();
    workerRef.current = worker;
    const onMessage = (event: MessageEvent<BatchWorkerResponse>) => {
      const message = event.data;
      if (message.type === "model-progress") {
        const key = `${message.qualityMode}:${inferencePath}` as const;
        const loaded = "loaded" in message ? message.loaded : 0;
        const total = "total" in message ? message.total : null;
        setSession((current) => {
          const previous = current.modelLoads[key];
          const percent = Math.max(
            previous?.percent ?? 0,
            Math.min(100, message.percent),
          );
          return {
            ...current,
            modelLoads: {
              ...current.modelLoads,
              [key]: {
                status: "downloading",
                percent,
                loadedBytes: loaded,
                totalBytes: total && total > 0 ? total : null,
                fromCache: null,
              } satisfies ModelLoadProgress,
            },
          };
        });
      } else if (message.type === "log" && message.message === "building ONNX session") {
        const key = `${message.qualityMode}:${inferencePath}` as const;
        setSession((current) => ({
          ...current,
          modelLoads: {
            ...current.modelLoads,
            [key]: {
              ...(current.modelLoads[key] ?? {
                percent: null,
                loadedBytes: 0,
                totalBytes: null,
                fromCache: null,
              }),
              status: "building-session",
            },
          },
        }));
      } else if (message.type === "model-ready") {
        loadingRef.current = false;
        modelReadyRef.current = true;
        const key = `${message.qualityMode}:${inferencePath}` as const;
        setSession((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.status === "model-loading"
              ? {
                  ...item,
                  status: "queued",
                  processingProgress: {
                    stage: "queued",
                    startedAt: null,
                    elapsedMs: performance.now() - item.enqueuedAt,
                    percent: null,
                  },
                }
              : item,
          ),
          modelLoads: {
            ...current.modelLoads,
            [key]: {
              status: "ready",
              percent: 100,
              loadedBytes: current.modelLoads[key]?.loadedBytes ?? 0,
              totalBytes: current.modelLoads[key]?.totalBytes ?? null,
              fromCache: current.modelLoads[key]?.loadedBytes ? false : null,
            },
          },
        }));
        queueMicrotask(dispatchQueued);
      } else if (message.type === "alpha-matte-result") {
        const pending = pendingMattesRef.current.get(message.requestId);
        if (pending) {
          pendingMattesRef.current.delete(message.requestId);
          pending.resolve(message.matte);
        }
      } else if (message.type === "recomposite-result") {
        const pending = pendingCompositesRef.current.get(message.requestId);
        if (pending) {
          pendingCompositesRef.current.delete(message.requestId);
          pending.resolve(message.result);
        }
      } else if (message.type === "process-result") {
        activeRef.current.delete(message.requestId);
        updateItem(message.requestId, (item) => ({
          ...item,
          status: "result",
          completedAt: performance.now(),
          processedImage: {
            source: item.source,
            result: message.result,
            qualityMode: item.qualityMode,
          },
          processingProgress: {
            ...item.processingProgress,
            stage: "complete",
            elapsedMs: message.durationMs,
          },
        }));
        queueMicrotask(dispatchQueued);
      } else if (message.type === "error" && message.requestId) {
        const pendingMatte = pendingMattesRef.current.get(message.requestId);
        if (pendingMatte) {
          pendingMattesRef.current.delete(message.requestId);
          pendingMatte.reject(new Error(message.message));
          return;
        }
        const pendingComposite = pendingCompositesRef.current.get(message.requestId);
        if (pendingComposite) {
          pendingCompositesRef.current.delete(message.requestId);
          pendingComposite.reject(new Error(message.message));
          return;
        }
        activeRef.current.delete(message.requestId);
        updateItem(message.requestId, (item) => ({
          ...item,
          status: "error",
          error: message.message,
        }));
        queueMicrotask(dispatchQueued);
      }
    };
    worker.addEventListener("message", onMessage);
    return () => {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, [batchStarted, dispatchQueued, inferencePath, updateItem, workerFactory]);

  useEffect(() => {
    const hasQueued = session.items.some((item) => item.status === "queued");
    if (!hasQueued || loadingRef.current || modelReadyRef.current || !workerRef.current)
      return;
    loadingRef.current = true;
    const key = `${qualityMode}:${inferencePath}` as const;
    const startedAt = performance.now();
    setSession((current) => ({
      ...current,
      items: current.items.map((item, index) =>
        item.status === "queued" && index < concurrencyLimit
          ? {
              ...item,
              status: "model-loading",
              processingProgress: {
                stage: "preparing",
                startedAt,
                elapsedMs: 0,
                percent: null,
              },
            }
          : item,
      ),
      modelLoads: {
        ...current.modelLoads,
        [key]: {
          status: "checking-cache",
          percent: null,
          loadedBytes: 0,
          totalBytes: null,
          fromCache: null,
        },
      },
    }));
    workerRef.current.postMessage({
      type: "load-model",
      qualityMode,
      inferencePath,
    } satisfies BatchWorkerRequest);
  }, [concurrencyLimit, inferencePath, qualityMode, session.items]);

  useEffect(() => {
    dispatchQueued();
  }, [dispatchQueued, session.items]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now();
      setSession((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.status === "queued"
            ? {
                ...item,
                processingProgress: {
                  ...item.processingProgress,
                  stage: "queued",
                  elapsedMs: now - item.enqueuedAt,
                },
              }
            : (item.status === "model-loading" || item.status === "processing") &&
                item.processingProgress.startedAt !== null
              ? {
                  ...item,
                  processingProgress: {
                    ...item.processingProgress,
                    elapsedMs: now - item.processingProgress.startedAt,
                  },
                }
              : item,
        ),
      }));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const enqueue = useCallback(
    (uploads: BatchUpload[]) => {
      const now = performance.now();
      const items = uploads.map(({ fileName, source }): BatchItem => ({
        id: crypto.randomUUID(),
        originalFileName: fileName,
        source,
        qualityMode,
        status: "queued",
        enqueuedAt: now,
        processingProgress: {
          stage: "queued",
          startedAt: null,
          elapsedMs: 0,
          percent: null,
        },
      }));
      for (const item of items) {
        queueRef.current.push(item.id);
        workRef.current.set(item.id, {
          qualityMode: item.qualityMode,
          source: item.source,
        });
      }
      setSession((current) => ({
        ...current,
        items: [...current.items, ...items],
      }));
    },
    [qualityMode],
  );

  const selectItem = useCallback(
    (id: string) =>
      setSession((current) =>
        current.items.some((item) => item.id === id && item.status === "result")
          ? { ...current, selectedItemId: id }
          : current,
      ),
    [],
  );
  const replaceResult = useCallback(
    (id: string, processedImage: ProcessedImage) =>
      updateItem(id, (item) => ({ ...item, processedImage })),
    [updateItem],
  );
  const extractMatte = useCallback(
    (image: ProcessedImage) =>
      new Promise<AlphaMatte>((resolve, reject) => {
        const requestId = `batch-matte-${crypto.randomUUID()}`;
        pendingMattesRef.current.set(requestId, { resolve, reject });
        workerRef.current?.postMessage({
          type: "extract-alpha-matte",
          requestId,
          result: image.result,
        } satisfies BatchWorkerRequest);
      }),
    [],
  );
  const recomposite = useCallback(
    (image: ProcessedImage, matte: AlphaMatte) =>
      new Promise<ProcessedImage>((resolve, reject) => {
        const requestId = `batch-composite-${crypto.randomUUID()}`;
        pendingCompositesRef.current.set(requestId, { resolve, reject });
        workerRef.current?.postMessage({
          type: "recomposite",
          requestId,
          image,
          matte,
        } satisfies BatchWorkerRequest);
      }),
    [],
  );
  const retryItem = useCallback(
    (id: string) => {
      const enqueuedAt = performance.now();
      if (!queueRef.current.includes(id)) queueRef.current.push(id);
      updateItem(id, (item) => ({
        ...item,
        status: "queued",
        error: undefined,
        processedImage: undefined,
        enqueuedAt,
        processingProgress: {
          stage: "queued",
          startedAt: null,
          elapsedMs: 0,
          percent: null,
        },
      }));
    },
    [updateItem],
  );
  const reset = useCallback(() => {
    activeRef.current.clear();
    queueRef.current = [];
    workRef.current.clear();
    setSession(emptySession);
  }, []);
  const snapshot = useMemo(
    () => deriveBatchSchedulerSnapshot(session, inferencePath, concurrencyLimit),
    [concurrencyLimit, inferencePath, session],
  );
  return {
    session,
    snapshot,
    enqueue,
    selectItem,
    replaceResult,
    retryItem,
    extractMatte,
    recomposite,
    reset,
  };
}
