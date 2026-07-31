import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Shared scaffolding for feature hooks that dispatch worker requests via a
 * request-id keyed pending-promise map and resolve every outstanding
 * request as "cancelled" on stop, rather than this project's other
 * cancel/dispose/disposed worker protocol (see `use-worker-lifecycle.ts`,
 * a different shape that doesn't fit this one). Extracted from
 * `useModelLab`/`useInteractiveMattingLab` (PHASE_31 F-09), whose
 * `getWorker`/`stopWorker` scaffolding was byte-for-byte identical.
 *
 * Does not wire its own unmount effect: callers that need `stopWorker()` on
 * unmount already have their own cleanup effect for other resources
 * (object URLs, capability-fetch cancellation) and call `stopWorker()`
 * inside it, same as before this extraction.
 */
export function usePendingRequestWorker<TMessage, TOutcome>(
  workerFactory: () => Worker,
  handleMessage: (message: TMessage) => void,
  cancelledOutcome: () => TOutcome,
  // A hard worker crash (uncaught exception, syntax error, OOM) never posts a
  // "message" — without this, every pending request hangs at its caller's
  // "running" status forever (PHASE_31 T8 full-inventory finding).
  errorOutcome: () => TOutcome,
) {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, (outcome: TOutcome) => void>());
  const requestCounterRef = useRef(0);
  const handleMessageRef = useRef(handleMessage);
  const cancelledOutcomeRef = useRef(cancelledOutcome);
  const errorOutcomeRef = useRef(errorOutcome);
  useEffect(
    function syncCallbackRefsFx() {
      handleMessageRef.current = handleMessage;
      cancelledOutcomeRef.current = cancelledOutcome;
      errorOutcomeRef.current = errorOutcome;
    },
    [handleMessage, cancelledOutcome, errorOutcome],
  );

  const nextRequestId = useCallback(function nextRequestId(prefix: string) {
    requestCounterRef.current += 1;
    return `${prefix}-${String(requestCounterRef.current)}`;
  }, []);

  const getWorker = useCallback(
    function getWorker() {
      let worker = workerRef.current;
      if (!worker) {
        worker = workerFactory();
        worker.addEventListener(
          "message",
          function handleWorkerMessage(event: MessageEvent<TMessage>) {
            handleMessageRef.current(event.data);
          },
        );
        worker.addEventListener("error", function handleWorkerError() {
          workerRef.current?.terminate();
          workerRef.current = null;
          for (const resolve of pendingRef.current.values())
            resolve(errorOutcomeRef.current());
          pendingRef.current.clear();
        });
        workerRef.current = worker;
      }
      return worker;
    },
    [workerFactory],
  );

  const registerPending = useCallback(function registerPending(
    requestId: string,
    resolve: (outcome: TOutcome) => void,
  ) {
    pendingRef.current.set(requestId, resolve);
  }, []);

  const resolvePending = useCallback(function resolvePending(
    requestId: string,
    outcome: TOutcome,
  ): boolean {
    const resolve = pendingRef.current.get(requestId);
    if (!resolve) return false;
    pendingRef.current.delete(requestId);
    resolve(outcome);
    return true;
  }, []);

  const stopWorker = useCallback(function stopWorker() {
    workerRef.current?.terminate();
    workerRef.current = null;
    for (const resolve of pendingRef.current.values())
      resolve(cancelledOutcomeRef.current());
    pendingRef.current.clear();
  }, []);

  return useMemo(
    () => ({ getWorker, nextRequestId, registerPending, resolvePending, stopWorker }),
    [getWorker, nextRequestId, registerPending, resolvePending, stopWorker],
  );
}
