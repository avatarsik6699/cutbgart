import { useCallback, useEffect, useRef, useState, useReducer } from "react";

import { trackEvent } from "@/shared/lib/analytics";

import type {
  AlphaMatte,
  DeviceCapabilities,
  InferencePath,
  ProcessedImage,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";
import { detectDeviceCapabilities } from "./device-capabilities";
import {
  initialRemoveBackgroundState,
  removeBackgroundReducer,
  type RemoveBackgroundError,
  type RemoveBackgroundErrorCode,
  type RemoveBackgroundState,
} from "./state-machine";
import type { WorkerRequest, WorkerResponse } from "../worker/inference.worker";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION_PX = 4096;
const ACCEPTED_FORMATS = ["image/jpeg", "image/png", "image/webp"] as const;
// Caps the optional log panel's memory footprint on long sessions (many
// retries/quality-mode switches) — oldest entries drop off first.
const MAX_LOG_ENTRIES = 200;

interface PendingWorkerRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export interface LogEntry {
  id: number;
  timestamp: number;
  message: string;
}

export interface RunInfo {
  inferencePath: InferencePath;
  dtype: string;
}

function isAcceptedFormat(type: string): type is SourceImage["format"] {
  return (ACCEPTED_FORMATS as readonly string[]).includes(type);
}

function actionForWorkerErrorCode(code: RemoveBackgroundErrorCode): "retry" | "reset" {
  return code === "unsupported-format" ||
    code === "file-too-large" ||
    code === "resolution-too-large"
    ? "reset"
    : "retry";
}

type BuildSourceImageResult =
  { ok: true; source: SourceImage } | { ok: false; error: RemoveBackgroundError };

/** Exported for unit testing (SPEC.md §7.7) — validation has no worker/React dependency. */
export async function buildSourceImage(file: File): Promise<BuildSourceImageResult> {
  if (!isAcceptedFormat(file.type)) {
    return {
      ok: false,
      error: {
        code: "unsupported-format",
        message: `Unsupported file format "${file.type || "unknown"}". Use JPEG, PNG, or WebP.`,
        action: "reset",
      },
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        code: "file-too-large",
        message: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is ${String(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
        action: "reset",
      },
    };
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();

  if (Math.max(width, height) > MAX_DIMENSION_PX) {
    return {
      ok: false,
      error: {
        code: "resolution-too-large",
        message: `Image resolution (${String(width)}x${String(height)}) exceeds the ${String(MAX_DIMENSION_PX)}px limit on the longest side.`,
        action: "reset",
      },
    };
  }

  return { ok: true, source: { blob: file, width, height, format: file.type } };
}

export interface UseBackgroundRemovalResult {
  state: RemoveBackgroundState;
  deviceCapabilities: DeviceCapabilities | null;
  lightweightMode: boolean;
  /** Model/dtype/inference-path actually behind the current or last run — null before the first attempt. */
  runInfo: RunInfo | null;
  /** Timestamped diagnostic trail (file downloads, state transitions, timings) for an optional debug log panel. */
  logs: LogEntry[];
  modelLoadBytes: { loaded: number; total: number | null };
  selectFile: (file: File) => void;
  recomputeMaxQuality: () => void;
  retry: () => void;
  reset: () => void;
  /** Enters `correcting` from `result` (Phase 07) — no worker/inference involved. */
  enterCorrecting: () => void;
  /** Returns to `result` from `correcting` with the corrected composite (Phase 07). */
  exitCorrecting: (result: ProcessedImage) => void;
  /** Extracts the current result PNG's alpha channel on the existing worker. */
  extractMatte: (image: ProcessedImage) => Promise<AlphaMatte>;
  /** Re-composites a corrected matte with the source image on the existing worker. */
  recomposite: (image: ProcessedImage, matte: AlphaMatte) => Promise<ProcessedImage>;
}

/**
 * @param qualityMode Overrides the device-detected default quality mode for new
 * file selections (SPEC.md §5.2 — `features/quality-mode-toggle` passes its
 * current value here, not hardcoded). Falls back to
 * `DeviceCapabilities.defaultQualityMode` when omitted.
 */
export function useBackgroundRemoval(
  qualityMode?: QualityMode,
): UseBackgroundRemovalResult {
  const [state, dispatch] = useReducer(
    removeBackgroundReducer,
    initialRemoveBackgroundState,
  );
  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities | null>(
    null,
  );
  const [lightweightMode, setLightweightMode] = useState(false);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modelLoadBytes, setModelLoadBytes] = useState({
    loaded: 0,
    total: null as number | null,
  });
  const logIdRef = useRef(0);

  const appendLog = useCallback((message: string) => {
    logIdRef.current += 1;
    const entry: LogEntry = { id: logIdRef.current, timestamp: Date.now(), message };
    setLogs((current) => [...current, entry].slice(-MAX_LOG_ENTRIES));
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const capabilitiesPromiseRef = useRef<Promise<DeviceCapabilities> | null>(null);
  const requestCounterRef = useRef(0);
  const pendingRequestIdRef = useRef<string | null>(null);
  const pendingAlphaMatteRequestsRef = useRef(
    new Map<string, PendingWorkerRequest<AlphaMatte>>(),
  );
  const pendingRecompositeRequestsRef = useRef(
    new Map<string, PendingWorkerRequest<ProcessedImage>>(),
  );
  const lastAttemptRef = useRef<{
    source: SourceImage;
    qualityMode: QualityMode;
    inferencePath: InferencePath;
  } | null>(null);
  // Tracks whether the in-flight attempt is still waiting on the model (vs.
  // already processing), so a worker "error" message can be attributed to
  // `model_load_failed` vs. `processing_failed` (SPEC.md §7.6) without
  // depending on `state.status` inside the worker's message handler, which is
  // only ever (re)bound once per worker instance (see `getWorker` below) and
  // would otherwise read a stale value.
  const awaitingModelLoadRef = useRef(false);

  const nextRequestId = useCallback(() => {
    const requestId = String(requestCounterRef.current + 1);
    requestCounterRef.current += 1;
    return requestId;
  }, []);

  const getDeviceCapabilities = useCallback((): Promise<DeviceCapabilities> => {
    capabilitiesPromiseRef.current ??= detectDeviceCapabilities();
    return capabilitiesPromiseRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getDeviceCapabilities().then((capabilities) => {
      if (cancelled) return;
      setDeviceCapabilities(capabilities);
      setLightweightMode(capabilities.inferencePath === "wasm");
    });
    return () => {
      cancelled = true;
    };
  }, [getDeviceCapabilities]);

  const handleWorkerMessage = useCallback(
    (message: WorkerResponse) => {
      switch (message.type) {
        case "model-progress": {
          const attempt = lastAttemptRef.current;
          if (attempt && attempt.qualityMode === message.qualityMode) {
            dispatch({ type: "MODEL_PROGRESS", percent: message.percent });
            setModelLoadBytes({
              loaded: message.loaded,
              total: message.total > 0 ? message.total : null,
            });
          }
          break;
        }
        case "log": {
          appendLog(message.message);
          break;
        }
        case "fallback-to-wasm": {
          const attempt = lastAttemptRef.current;
          if (attempt && attempt.qualityMode === message.qualityMode) {
            setLightweightMode(true);
            appendLog("WebGPU failed on this run — falling back to WASM");
          }
          break;
        }
        case "model-ready": {
          const attempt = lastAttemptRef.current;
          if (!attempt || attempt.qualityMode !== message.qualityMode) break;
          awaitingModelLoadRef.current = false;
          setRunInfo({ inferencePath: message.inferencePath, dtype: message.dtype });
          appendLog(
            `Model ready — ${message.qualityMode} quality, dtype ${message.dtype}, ${message.inferencePath}`,
          );
          trackEvent("model_load_completed");
          dispatch({ type: "MODEL_READY" });
          dispatch({ type: "START_PROCESSING" });
          trackEvent("processing_started");
          appendLog("Processing started");
          const requestId = nextRequestId();
          pendingRequestIdRef.current = requestId;
          const worker = workerRef.current;
          if (worker) {
            const request: WorkerRequest = {
              type: "process",
              requestId,
              qualityMode: attempt.qualityMode,
              inferencePath: attempt.inferencePath,
              source: attempt.source,
            };
            worker.postMessage(request);
          }
          break;
        }
        case "process-result": {
          if (message.requestId !== pendingRequestIdRef.current) break;
          const attempt = lastAttemptRef.current;
          if (!attempt) break;
          const result: ProcessedImage = {
            source: attempt.source,
            result: message.result,
            qualityMode: attempt.qualityMode,
          };
          appendLog(`Processing completed in ${String(message.durationMs)}ms`);
          trackEvent("processing_completed");
          dispatch({ type: "PROCESSING_SUCCEEDED", result });
          break;
        }
        case "alpha-matte-result": {
          const pending = pendingAlphaMatteRequestsRef.current.get(message.requestId);
          if (!pending) break;
          pendingAlphaMatteRequestsRef.current.delete(message.requestId);
          appendLog(`Correction matte extracted in ${String(message.durationMs)}ms`);
          pending.resolve(message.matte);
          break;
        }
        case "recomposite-result": {
          const pending = pendingRecompositeRequestsRef.current.get(message.requestId);
          if (!pending) break;
          pendingRecompositeRequestsRef.current.delete(message.requestId);
          appendLog(`Correction composite updated in ${String(message.durationMs)}ms`);
          pending.resolve(message.result);
          break;
        }
        case "error": {
          if (message.requestId) {
            const alphaPending = pendingAlphaMatteRequestsRef.current.get(
              message.requestId,
            );
            if (alphaPending) {
              pendingAlphaMatteRequestsRef.current.delete(message.requestId);
              appendLog(`Correction matte extraction failed: ${message.message}`);
              alphaPending.reject(new Error(message.message));
              break;
            }

            const recompositePending = pendingRecompositeRequestsRef.current.get(
              message.requestId,
            );
            if (recompositePending) {
              pendingRecompositeRequestsRef.current.delete(message.requestId);
              appendLog(`Correction recomposite failed: ${message.message}`);
              recompositePending.reject(new Error(message.message));
              break;
            }
          }
          if (message.code === "compositing-failed") {
            appendLog(`Ignored stale correction compositing error: ${message.message}`);
            break;
          }
          appendLog(`Error (${message.code}): ${message.message}`);
          trackEvent(
            awaitingModelLoadRef.current ? "model_load_failed" : "processing_failed",
          );
          const errorCode = message.code;
          dispatch({
            type: "FAILED",
            error: {
              code: errorCode,
              message: message.message,
              action: actionForWorkerErrorCode(errorCode),
            },
          });
          break;
        }
      }
    },
    [appendLog, nextRequestId],
  );

  const getWorker = useCallback((): Worker => {
    let worker = workerRef.current;
    if (!worker) {
      worker = new Worker(new URL("../worker/inference.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
        handleWorkerMessage(event.data);
      });
      workerRef.current = worker;
    }
    return worker;
  }, [handleWorkerMessage]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const startAttempt = useCallback(
    (source: SourceImage, qualityMode: QualityMode) => {
      // Only the idle/error -> model-loading transition counts as a fresh
      // model-load funnel event (SPEC.md §7.6) — not "recompute in max
      // quality", which re-enters from `result` with the same source.
      if (state.status === "idle" || state.status === "error") {
        trackEvent("model_load_started");
      }
      awaitingModelLoadRef.current = true;
      setRunInfo(null);
      dispatch({ type: "SELECT_FILE", qualityMode });
      void getDeviceCapabilities().then((capabilities) => {
        lastAttemptRef.current = {
          source,
          qualityMode,
          inferencePath: capabilities.inferencePath,
        };
        appendLog(`Requesting ${qualityMode} model on ${capabilities.inferencePath}`);
        const worker = getWorker();
        const request: WorkerRequest = {
          type: "load-model",
          qualityMode,
          inferencePath: capabilities.inferencePath,
        };
        worker.postMessage(request);
      });
    },
    [appendLog, getDeviceCapabilities, getWorker, state.status],
  );

  const selectFile = useCallback(
    (file: File) => {
      void buildSourceImage(file).then((result) => {
        if (!result.ok) {
          appendLog(`Upload rejected: ${result.error.message}`);
          dispatch({ type: "FAILED", error: result.error });
          return;
        }
        void getDeviceCapabilities().then((capabilities) => {
          startAttempt(result.source, qualityMode ?? capabilities.defaultQualityMode);
        });
      });
    },
    [appendLog, getDeviceCapabilities, startAttempt, qualityMode],
  );

  const recomputeMaxQuality = useCallback(() => {
    const attempt = lastAttemptRef.current;
    if (state.status === "result" && attempt) {
      startAttempt(attempt.source, "max");
    }
  }, [startAttempt, state.status]);

  const retry = useCallback(() => {
    const attempt = lastAttemptRef.current;
    if (attempt) {
      startAttempt(attempt.source, attempt.qualityMode);
    }
  }, [startAttempt]);

  const reset = useCallback(() => {
    lastAttemptRef.current = null;
    pendingRequestIdRef.current = null;
    setRunInfo(null);
    dispatch({ type: "RESET" });
  }, []);

  const enterCorrecting = useCallback(() => {
    dispatch({ type: "ENTER_CORRECTING" });
  }, []);

  const exitCorrecting = useCallback((result: ProcessedImage) => {
    dispatch({ type: "EXIT_CORRECTING", result });
  }, []);

  const extractMatte = useCallback(
    (image: ProcessedImage): Promise<AlphaMatte> => {
      const requestId = nextRequestId();
      appendLog("Extracting correction matte on worker");
      return new Promise((resolve, reject) => {
        pendingAlphaMatteRequestsRef.current.set(requestId, { resolve, reject });
        getWorker().postMessage({
          type: "extract-alpha-matte",
          requestId,
          result: image.result,
        } satisfies WorkerRequest);
      });
    },
    [appendLog, getWorker, nextRequestId],
  );

  const recomposite = useCallback(
    (image: ProcessedImage, matte: AlphaMatte): Promise<ProcessedImage> => {
      const requestId = nextRequestId();
      appendLog("Updating correction composite on worker");
      return new Promise((resolve, reject) => {
        pendingRecompositeRequestsRef.current.set(requestId, { resolve, reject });
        getWorker().postMessage({
          type: "recomposite",
          requestId,
          image,
          matte,
        } satisfies WorkerRequest);
      });
    },
    [appendLog, getWorker, nextRequestId],
  );

  return {
    state,
    deviceCapabilities,
    lightweightMode,
    runInfo,
    logs,
    modelLoadBytes,
    selectFile,
    recomputeMaxQuality,
    retry,
    reset,
    enterCorrecting,
    exitCorrecting,
    extractMatte,
    recomposite,
  };
}
