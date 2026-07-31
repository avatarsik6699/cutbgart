import { useCallback, useEffect, useMemo, useRef } from "react";

interface WorkerLifecycleMessage {
  type: string;
  requestId: string;
}

/**
 * Shared worker init/postMessage/terminate scaffolding for feature hooks
 * that follow this project's request-id + cancel/dispose/disposed worker
 * protocol (PHASE_31 F-09; `docs/FRONTEND_CONVENTIONS.md` §9). Extracted
 * from `useForegroundRefinement`/`useMatteRefinement`, which had byte-for-
 * byte identical lifecycle code — this hook owns lazy worker creation,
 * request-id counting, active-request filtering, dispose-acknowledgement
 * bookkeeping, and terminate-on-unmount. Each feature hook keeps its own
 * message-payload types and business-logic message handler.
 */
export function useWorkerLifecycle<TMessage extends WorkerLifecycleMessage>(
  workerFactory: () => Worker,
  onMessage: (message: TMessage) => void,
) {
  const workerRef = useRef<Worker | null>(null);
  const requestCounterRef = useRef(0);
  const activeRequestRef = useRef<string | null>(null);
  const pendingDisposeRef = useRef(new Map<string, () => void>());
  const onMessageRef = useRef(onMessage);
  useEffect(
    function syncOnMessageRefFx() {
      onMessageRef.current = onMessage;
    },
    [onMessage],
  );

  const nextRequestId = useCallback(function nextRequestId(prefix: string) {
    requestCounterRef.current += 1;
    return `${prefix}-${String(requestCounterRef.current)}`;
  }, []);

  const getWorker = useCallback(
    function getWorker() {
      if (workerRef.current) return workerRef.current;
      const worker = workerFactory();
      worker.addEventListener(
        "message",
        function handleMessage(event: MessageEvent<TMessage>) {
          const message = event.data;
          if (message.type === "disposed") {
            pendingDisposeRef.current.get(message.requestId)?.();
            pendingDisposeRef.current.delete(message.requestId);
            return;
          }
          if (message.requestId !== activeRequestRef.current) return;
          onMessageRef.current(message);
        },
      );
      workerRef.current = worker;
      return worker;
    },
    [workerFactory],
  );

  const setActiveRequest = useCallback(function setActiveRequest(
    requestId: string | null,
  ) {
    activeRequestRef.current = requestId;
  }, []);

  const cancelActive = useCallback(function cancelActive() {
    const requestId = activeRequestRef.current;
    if (requestId) workerRef.current?.postMessage({ type: "cancel", requestId });
    activeRequestRef.current = null;
  }, []);

  const release = useCallback(
    function release(): Promise<void> {
      const worker = workerRef.current;
      if (!worker) return Promise.resolve();
      const requestId = nextRequestId("dispose");
      return new Promise((resolve) => {
        pendingDisposeRef.current.set(requestId, resolve);
        worker.postMessage({ type: "dispose", requestId });
      });
    },
    [nextRequestId],
  );

  const terminate = useCallback(
    function terminate() {
      cancelActive();
      workerRef.current?.terminate();
      workerRef.current = null;
      for (const resolve of pendingDisposeRef.current.values()) resolve();
      pendingDisposeRef.current.clear();
    },
    [cancelActive],
  );

  useEffect(
    function terminateOnUnmountFx() {
      return terminate;
    },
    [terminate],
  );

  return useMemo(
    () => ({
      getWorker,
      nextRequestId,
      activeRequestRef,
      setActiveRequest,
      cancelActive,
      release,
      terminate,
    }),
    [getWorker, nextRequestId, setActiveRequest, cancelActive, release, terminate],
  );
}
