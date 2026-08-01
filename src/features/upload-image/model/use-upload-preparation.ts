import { useCallback, useEffect, useMemo, useRef } from "react";

import { validateAndPrepareUpload } from "./validate-and-prepare-upload";
import type { UploadPreparationTypes } from "./upload-preparation.types";
import type { UploadResult } from "./types";

function createPreparationWorker(): Worker {
  return new Worker(new URL("../worker/upload-preparation.worker.ts", import.meta.url), {
    type: "module",
  });
}

function failedPreparation(message: string): UploadResult {
  return {
    ok: false,
    error: {
      code: "unsupported-format",
      message,
    },
  };
}

export function useUploadPreparation(workerFactory = createPreparationWorker) {
  const workerRef = useRef<Worker | null>(null);
  const requestCounterRef = useRef(0);
  const pendingRef = useRef(new Map<string, (result: UploadResult) => void>());

  const finishPending = useCallback((result: UploadResult) => {
    for (const resolve of pendingRef.current.values()) resolve(result);
    pendingRef.current.clear();
  }, []);

  const stopWorker = useCallback(
    (message = "Image preparation was cancelled") => {
      workerRef.current?.terminate();
      workerRef.current = null;
      finishPending(failedPreparation(message));
    },
    [finishPending],
  );

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = workerFactory();
    worker.addEventListener(
      "message",
      function handlePreparedMessage(
        event: MessageEvent<UploadPreparationTypes.Response>,
      ) {
        const resolve = pendingRef.current.get(event.data.requestId);
        if (!resolve) return;
        pendingRef.current.delete(event.data.requestId);
        resolve(event.data.result);
      },
    );
    worker.addEventListener("error", function handlePreparationWorkerError(event) {
      event.preventDefault();
      stopWorker(
        event instanceof ErrorEvent && event.message
          ? event.message
          : "Image preparation worker stopped unexpectedly",
      );
    });
    worker.addEventListener("messageerror", function handlePreparationMessageError() {
      stopWorker("Image preparation worker returned an unreadable response");
    });
    workerRef.current = worker;
    return worker;
  }, [stopWorker, workerFactory]);

  const prepareFile = useCallback(
    (file: File): Promise<UploadResult> => {
      if (typeof Worker === "undefined") return validateAndPrepareUpload(file);
      requestCounterRef.current += 1;
      const requestId = `upload-${String(requestCounterRef.current)}`;
      return new Promise((resolve) => {
        pendingRef.current.set(requestId, resolve);
        getWorker().postMessage({
          type: "prepare",
          requestId,
          file,
        } satisfies UploadPreparationTypes.Request);
      });
    },
    [getWorker],
  );

  const prepareFiles = useCallback(
    (files: readonly File[]): Promise<UploadPreparationTypes.PreparedUpload[]> =>
      Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          result: await prepareFile(file),
        })),
      ),
    [prepareFile],
  );

  useEffect(
    function stopPreparationWorkerOnUnmountFx() {
      return function stopPreparationWorkerOnUnmountCleanupFx() {
        stopWorker("Image preparation was cancelled on unmount");
      };
    },
    [stopWorker],
  );

  return useMemo(
    () => ({ prepareFile, prepareFiles, stopWorker }),
    [prepareFile, prepareFiles, stopWorker],
  );
}
