import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m } from "@/paraglide/messages";

import {
  createEditDocumentScope,
  disposeEditDocumentScope,
  type EditDocumentScope,
} from "../../../entities/edit-document";
import type {
  AlphaMatte,
  BackgroundFill,
  InferenceWorkerRequest as BatchWorkerRequest,
  InferenceWorkerResponse as BatchWorkerResponse,
  InferencePath,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";
import {
  deriveBatchSchedulerSnapshot,
  type BatchItem,
  type BatchItemError,
  type BatchSession,
  type ModelLoadProgress,
} from "./types";

export type BatchUpload = {
  fileName: string;
  source: SourceImage;
};

export type UseBatchProcessingOptions = {
  qualityMode: QualityMode;
  inferencePath: InferencePath;
  concurrencyLimit?: 1 | 2;
  workerFactory?: () => Worker;
};

const emptySession: BatchSession = { items: [], selectedItemId: null, modelLoads: {} };

function createBatchItemError(code: string): BatchItemError {
  const normalizedCode = code || "processing-failed";
  return {
    code: normalizedCode,
    message: m.batchProcessingFailed(),
    detail:
      normalizedCode === "worker-crashed" || normalizedCode === "message-error"
        ? m.batchWorkerFailureDetail()
        : normalizedCode === "model-load-failed"
          ? m.batchModelFailureDetail()
          : m.batchItemFailureDetail(),
    retryable: true,
  };
}

function createInferenceWorker(): Worker {
  return new Worker(
    new URL("../../remove-background/worker/inference.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
}

export function useBatchProcessing(options: UseBatchProcessingOptions) {
  const qualityMode = options.qualityMode;
  const inferencePath = options.inferencePath;
  const concurrencyLimit =
    options.concurrencyLimit ??
    (qualityMode === "ben2-fp16" ? 1 : inferencePath === "webgpu" ? 2 : 1);
  const workerFactoryRef = useRef(options.workerFactory);
  const [session, setSession] = useState<BatchSession>(emptySession);
  const [workerEpoch, setWorkerEpoch] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const modelReadyRef = useRef(false);
  const loadingRef = useRef(false);
  const activeRef = useRef(new Map<string, string>());
  const itemByRequestRef = useRef(new Map<string, string>());
  const requestCounterRef = useRef(0);
  const modelRunRef = useRef<string | null>(null);
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
  const pendingDisposalsRef = useRef(new Map<string, () => void>());
  const documentScopesRef = useRef(new Map<string, EditDocumentScope>());

  const settlePendingWork = useCallback(function settlePendingWork(error: Error): void {
    for (const pending of pendingMattesRef.current.values()) pending.reject(error);
    pendingMattesRef.current.clear();
    for (const pending of pendingCompositesRef.current.values()) pending.reject(error);
    pendingCompositesRef.current.clear();
    for (const resolve of pendingDisposalsRef.current.values()) resolve();
    pendingDisposalsRef.current.clear();
  }, []);

  const nextRequestId = useCallback(function nextRequestId(prefix: string): string {
    requestCounterRef.current += 1;
    return `${prefix}-${String(requestCounterRef.current)}`;
  }, []);

  const invalidateItemRun = useCallback(function invalidateItemRun(id: string): void {
    const requestId = activeRef.current.get(id);
    if (requestId) itemByRequestRef.current.delete(requestId);
    activeRef.current.delete(id);
  }, []);

  const updateItem = useCallback((id: string, update: (item: BatchItem) => BatchItem) => {
    setSession((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? update(item) : item)),
    }));
  }, []);

  const dispatchQueued = useCallback(() => {
    const worker = workerRef.current;
    if (!modelReadyRef.current || !worker) return;
    const firstQueued = queueRef.current[0];
    const nextMode = firstQueued
      ? workRef.current.get(firstQueued)?.qualityMode
      : undefined;
    const activeMode = [...activeRef.current.keys()]
      .map((id) => workRef.current.get(id)?.qualityMode)
      .find(Boolean);
    // Model switches wait for the previous mode's active work to settle. The
    // worker can then dispose the old ONNX session before loading the new one.
    if (activeMode && nextMode && activeMode !== nextMode) return;
    const available = concurrencyLimit - activeRef.current.size;
    if (available <= 0) return;
    const queuedIds: string[] = [];
    while (queuedIds.length < available && queueRef.current.length) {
      const id = queueRef.current[0]!;
      if (nextMode && workRef.current.get(id)?.qualityMode !== nextMode) break;
      queuedIds.push(queueRef.current.shift()!);
    }
    if (!queuedIds.length) return;
    const started = performance.now();
    for (const id of queuedIds) {
      const work = workRef.current.get(id);
      if (!work) continue;
      const requestId = nextRequestId(`batch-${id}`);
      activeRef.current.set(id, requestId);
      itemByRequestRef.current.set(requestId, id);
      worker.postMessage({
        type: "process",
        requestId,
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
  }, [concurrencyLimit, inferencePath, nextRequestId]);

  const batchStarted = session.items.length > 0;

  useEffect(
    function synchronizeWorkerFactoryFx() {
      workerFactoryRef.current = options.workerFactory;
    },
    [options.workerFactory],
  );

  useEffect(
    function ownBatchWorkerFx() {
      if (!batchStarted) return;
      const worker = workerFactoryRef.current?.() ?? createInferenceWorker();
      const activeRuns = activeRef.current;
      const itemsByRequest = itemByRequestRef.current;
      let isCurrentWorker = true;
      workerRef.current = worker;
      function terminalizeWorker(error: Error, code: string): void {
        if (!isCurrentWorker) return;
        isCurrentWorker = false;
        modelReadyRef.current = false;
        loadingRef.current = false;
        modelRunRef.current = null;
        activeRuns.clear();
        itemsByRequest.clear();
        queueRef.current = [];
        settlePendingWork(error);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onWorkerError);
        worker.removeEventListener("messageerror", onWorkerMessageError);
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        setSession((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.status === "queued" ||
            item.status === "model-loading" ||
            item.status === "processing"
              ? { ...item, status: "error", error: createBatchItemError(code) }
              : item,
          ),
        }));
        setWorkerEpoch((current) => current + 1);
      }
      function onWorkerError(event: ErrorEvent): void {
        terminalizeWorker(
          new Error(event.message || "Batch worker crashed"),
          "worker-crashed",
        );
      }
      function onWorkerMessageError(): void {
        terminalizeWorker(
          new Error("Batch worker message could not be decoded"),
          "message-error",
        );
      }
      function isCurrentModelMessage(message: BatchWorkerResponse): boolean {
        if (!("requestId" in message) || !message.requestId) return true;
        return message.requestId === modelRunRef.current;
      }
      const onMessage = (event: MessageEvent<BatchWorkerResponse>) => {
        const message = event.data;
        if (message.type === "model-progress") {
          if (!isCurrentModelMessage(message)) return;
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
        } else if (
          message.type === "log" &&
          message.message === "building ONNX session"
        ) {
          if (!isCurrentModelMessage(message)) return;
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
          if (!isCurrentModelMessage(message)) return;
          loadingRef.current = false;
          modelReadyRef.current = true;
          modelRunRef.current = null;
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
        } else if (message.type === "disposed") {
          pendingDisposalsRef.current.get(message.requestId)?.();
          pendingDisposalsRef.current.delete(message.requestId);
          modelReadyRef.current = false;
        } else if (message.type === "process-result") {
          const itemId = itemByRequestRef.current.get(message.requestId);
          if (!itemId || activeRef.current.get(itemId) !== message.requestId) return;
          itemByRequestRef.current.delete(message.requestId);
          activeRef.current.delete(itemId);
          updateItem(itemId, (item) => {
            const processedImage: ProcessedImage = {
              source: item.source,
              result: message.result,
              cutout: message.result,
              qualityMode: item.qualityMode,
              alphaMatte: message.matte,
              backgroundFill: { type: "transparent" },
              backgroundPending: false,
            };
            const previousScope = documentScopesRef.current.get(item.id);
            if (previousScope) disposeEditDocumentScope(previousScope);
            const editDocument = createEditDocumentScope(processedImage, {
              inferencePath,
            });
            documentScopesRef.current.set(item.id, editDocument);
            return {
              ...item,
              status: "result",
              completedAt: performance.now(),
              processedImage,
              editDocument,
              processingProgress: {
                ...item.processingProgress,
                stage: "complete",
                elapsedMs: message.durationMs,
              },
            };
          });
          queueMicrotask(dispatchQueued);
        } else if (message.type === "error" && message.requestId) {
          if (message.requestId === modelRunRef.current) {
            loadingRef.current = false;
            modelReadyRef.current = false;
            modelRunRef.current = null;
            queueRef.current = [];
            setSession((current) => ({
              ...current,
              items: current.items.map((item) =>
                item.status === "queued" || item.status === "model-loading"
                  ? {
                      ...item,
                      status: "error",
                      error: createBatchItemError(message.code),
                    }
                  : item,
              ),
            }));
            return;
          }
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
          const itemId = itemByRequestRef.current.get(message.requestId);
          if (!itemId || activeRef.current.get(itemId) !== message.requestId) return;
          itemByRequestRef.current.delete(message.requestId);
          activeRef.current.delete(itemId);
          updateItem(itemId, (item) => ({
            ...item,
            status: "error",
            error: createBatchItemError(message.code),
          }));
          queueMicrotask(dispatchQueued);
        }
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onWorkerError);
      worker.addEventListener("messageerror", onWorkerMessageError);
      return function releaseBatchWorker() {
        isCurrentWorker = false;
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onWorkerError);
        worker.removeEventListener("messageerror", onWorkerMessageError);
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        modelReadyRef.current = false;
        loadingRef.current = false;
        modelRunRef.current = null;
        activeRuns.clear();
        itemsByRequest.clear();
        settlePendingWork(new Error("Batch worker was unmounted or disposed"));
      };
    },
    [
      batchStarted,
      dispatchQueued,
      inferencePath,
      settlePendingWork,
      updateItem,
      workerEpoch,
    ],
  );

  useEffect(function ownDocumentScopesFx() {
    const documentScopes = documentScopesRef.current;
    return function releaseDocumentScopes() {
      for (const scope of documentScopes.values()) disposeEditDocumentScope(scope);
      documentScopes.clear();
    };
  }, []);

  useEffect(
    function loadBatchModelFx() {
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
      const requestId = nextRequestId("batch-model");
      modelRunRef.current = requestId;
      workerRef.current.postMessage({
        type: "load-model",
        requestId,
        qualityMode,
        inferencePath,
      } satisfies BatchWorkerRequest);
    },
    [concurrencyLimit, inferencePath, nextRequestId, qualityMode, session.items],
  );

  useEffect(
    function dispatchBatchQueueFx() {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizes the React snapshot with the external Worker queue.
      dispatchQueued();
    },
    [dispatchQueued, session.items],
  );

  useEffect(function trackBatchElapsedTimeFx() {
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
    return function stopBatchElapsedTimer() {
      window.clearInterval(timer);
    };
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
    (id: string, processedImage: ProcessedImage, editDocument?: EditDocumentScope) =>
      updateItem(id, (item) => {
        const nextScope = editDocument ?? item.editDocument;
        if (nextScope) documentScopesRef.current.set(id, nextScope);
        return { ...item, processedImage, editDocument: nextScope };
      }),
    [updateItem],
  );
  const extractMatte = useCallback((image: ProcessedImage) => {
    if (image.alphaMatte) return Promise.resolve(image.alphaMatte);
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error("Batch worker is unavailable"));
    return new Promise<AlphaMatte>((resolve, reject) => {
      const requestId = `batch-matte-${crypto.randomUUID()}`;
      pendingMattesRef.current.set(requestId, { resolve, reject });
      worker.postMessage({
        type: "extract-alpha-matte",
        requestId,
        result: image.result,
      } satisfies BatchWorkerRequest);
    });
  }, []);
  const recomposite = useCallback((image: ProcessedImage, matte: AlphaMatte) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error("Batch worker is unavailable"));
    return new Promise<ProcessedImage>((resolve, reject) => {
      const requestId = `batch-composite-${crypto.randomUUID()}`;
      pendingCompositesRef.current.set(requestId, { resolve, reject });
      worker.postMessage({
        type: "recomposite",
        requestId,
        image,
        matte,
      } satisfies BatchWorkerRequest);
    });
  }, []);
  const applyBackgroundFill = useCallback(
    (image: ProcessedImage, backgroundFill: BackgroundFill) => {
      const matte = image.alphaMatte;
      if (!matte) return Promise.reject(new Error("Background matte is unavailable"));
      const worker = workerRef.current;
      if (!worker) return Promise.reject(new Error("Batch worker is unavailable"));
      return new Promise<ProcessedImage>((resolve, reject) => {
        const requestId = `batch-background-${crypto.randomUUID()}`;
        pendingCompositesRef.current.set(requestId, {
          resolve,
          reject,
        });
        worker.postMessage({
          type: "recomposite",
          requestId,
          image: { ...image, alphaMatte: undefined },
          matte,
          backgroundFill,
        } satisfies BatchWorkerRequest);
      });
    },
    [],
  );
  const retryItem = useCallback(
    (id: string) => {
      const enqueuedAt = performance.now();
      invalidateItemRun(id);
      if (!queueRef.current.includes(id)) queueRef.current.push(id);
      const scope = documentScopesRef.current.get(id);
      if (scope) disposeEditDocumentScope(scope);
      documentScopesRef.current.delete(id);
      updateItem(id, (item) => ({
        ...item,
        status: "queued",
        error: undefined,
        processedImage: undefined,
        editDocument: undefined,
        enqueuedAt,
        processingProgress: {
          stage: "queued",
          startedAt: null,
          elapsedMs: 0,
          percent: null,
        },
      }));
    },
    [invalidateItemRun, updateItem],
  );
  const removeItem = useCallback(
    (id: string) => {
      const scope = documentScopesRef.current.get(id);
      if (scope) disposeEditDocumentScope(scope);
      documentScopesRef.current.delete(id);
      queueRef.current = queueRef.current.filter((queuedId) => queuedId !== id);
      invalidateItemRun(id);
      workRef.current.delete(id);
      setSession((current) => {
        const removedIndex = current.items.findIndex((item) => item.id === id);
        const items = current.items.filter((item) => item.id !== id);
        const fallback =
          current.selectedItemId === id
            ? (items
                .slice(Math.max(0, removedIndex))
                .find((item) => item.status === "result") ??
              items
                .slice(0, Math.max(0, removedIndex))
                .reverse()
                .find((item) => item.status === "result") ??
              null)
            : null;
        return {
          ...current,
          selectedItemId:
            current.selectedItemId === id
              ? (fallback?.id ?? null)
              : current.selectedItemId,
          items,
        };
      });
    },
    [invalidateItemRun],
  );
  const reset = useCallback(() => {
    activeRef.current.clear();
    itemByRequestRef.current.clear();
    queueRef.current = [];
    workRef.current.clear();
    for (const scope of documentScopesRef.current.values())
      disposeEditDocumentScope(scope);
    documentScopesRef.current.clear();
    setSession(emptySession);
  }, []);
  const releaseInference = useCallback((): Promise<void> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve();
    const requestId = `batch-dispose-${crypto.randomUUID()}`;
    return new Promise((resolve) => {
      pendingDisposalsRef.current.set(requestId, resolve);
      worker.postMessage({ type: "dispose", requestId } satisfies BatchWorkerRequest);
    });
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
    removeItem,
    retryItem,
    extractMatte,
    recomposite,
    applyBackgroundFill,
    releaseInference,
    reset,
  };
}
