import { useCallback, useEffect, useRef, useState, useReducer } from "react";

import type {
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
  selectFile: (file: File) => void;
  recomputeMaxQuality: () => void;
  retry: () => void;
  reset: () => void;
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

  const workerRef = useRef<Worker | null>(null);
  const capabilitiesPromiseRef = useRef<Promise<DeviceCapabilities> | null>(null);
  const requestCounterRef = useRef(0);
  const pendingRequestIdRef = useRef<string | null>(null);
  const lastAttemptRef = useRef<{
    source: SourceImage;
    qualityMode: QualityMode;
    inferencePath: InferencePath;
  } | null>(null);

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

  const handleWorkerMessage = useCallback((message: WorkerResponse) => {
    switch (message.type) {
      case "model-progress": {
        const attempt = lastAttemptRef.current;
        if (attempt && attempt.qualityMode === message.qualityMode) {
          dispatch({ type: "MODEL_PROGRESS", percent: message.percent });
        }
        break;
      }
      case "fallback-to-wasm": {
        const attempt = lastAttemptRef.current;
        if (attempt && attempt.qualityMode === message.qualityMode) {
          setLightweightMode(true);
        }
        break;
      }
      case "model-ready": {
        const attempt = lastAttemptRef.current;
        if (!attempt || attempt.qualityMode !== message.qualityMode) break;
        dispatch({ type: "MODEL_READY" });
        dispatch({ type: "START_PROCESSING" });
        const requestId = String(requestCounterRef.current + 1);
        requestCounterRef.current += 1;
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
        dispatch({ type: "PROCESSING_SUCCEEDED", result });
        break;
      }
      case "error": {
        dispatch({
          type: "FAILED",
          error: {
            code: message.code,
            message: message.message,
            action: actionForWorkerErrorCode(message.code),
          },
        });
        break;
      }
    }
  }, []);

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
      dispatch({ type: "SELECT_FILE", qualityMode });
      void getDeviceCapabilities().then((capabilities) => {
        lastAttemptRef.current = {
          source,
          qualityMode,
          inferencePath: capabilities.inferencePath,
        };
        const worker = getWorker();
        const request: WorkerRequest = {
          type: "load-model",
          qualityMode,
          inferencePath: capabilities.inferencePath,
        };
        worker.postMessage(request);
      });
    },
    [getDeviceCapabilities, getWorker],
  );

  const selectFile = useCallback(
    (file: File) => {
      void buildSourceImage(file).then((result) => {
        if (!result.ok) {
          dispatch({ type: "FAILED", error: result.error });
          return;
        }
        void getDeviceCapabilities().then((capabilities) => {
          startAttempt(result.source, qualityMode ?? capabilities.defaultQualityMode);
        });
      });
    },
    [getDeviceCapabilities, startAttempt, qualityMode],
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
    dispatch({ type: "RESET" });
  }, []);

  return {
    state,
    deviceCapabilities,
    lightweightMode,
    selectFile,
    recomputeMaxQuality,
    retry,
    reset,
  };
}
