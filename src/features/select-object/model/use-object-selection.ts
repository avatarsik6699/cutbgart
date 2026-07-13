import { useCallback, useEffect, useRef, useState } from "react";

import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import type {
  ObjectSelectionStatus,
  SelectionPrompt,
  SelectObjectWorkerRequest,
  SelectObjectWorkerResponse,
} from "./types";

export interface ObjectSelectionState {
  status: ObjectSelectionStatus;
  source: SourceImage | null;
  matte: AlphaMatte | null;
  prompt: SelectionPrompt | null;
  error: string | null;
  progress: number | null;
}

const initialState: ObjectSelectionState = {
  status: "idle",
  source: null,
  matte: null,
  prompt: null,
  error: null,
  progress: null,
};

export function useObjectSelection(
  workerFactory = () =>
    new Worker(new URL("../worker/select-object.worker.ts", import.meta.url), {
      type: "module",
    }),
) {
  const [state, setState] = useState(initialState);
  const workerRef = useRef<Worker | null>(null);
  const lastPromptRef = useRef<SelectionPrompt | null>(null);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = workerFactory();
    const failWorker = (message: string) => {
      if (workerRef.current === worker) {
        worker.terminate();
        workerRef.current = null;
      }
      setState((current) => ({
        ...current,
        status: "error",
        error: message,
        progress: null,
      }));
    };
    worker.addEventListener(
      "message",
      (event: MessageEvent<SelectObjectWorkerResponse>) => {
        const message = event.data;
        if (message.type === "status") {
          setState((current) => ({
            ...current,
            status: message.status,
            error: null,
            progress: message.progress ?? null,
          }));
        } else if (message.type === "preview") {
          setState((current) => ({
            ...current,
            status: "preview",
            matte: message.matte,
            error: null,
            progress: null,
          }));
        } else {
          setState((current) => ({
            ...current,
            status: "error",
            error: message.message,
            progress: null,
          }));
        }
      },
    );
    worker.addEventListener("error", (event) => {
      event.preventDefault();
      failWorker(
        event instanceof ErrorEvent && event.message
          ? event.message
          : "Guided-selection worker stopped unexpectedly",
      );
    });
    worker.addEventListener("messageerror", () => {
      failWorker("Guided-selection worker returned an unreadable response");
    });
    workerRef.current = worker;
    return worker;
  }, [workerFactory]);

  const post = useCallback(
    (request: SelectObjectWorkerRequest) => {
      try {
        getWorker().postMessage(request);
      } catch (error) {
        setState((current) => ({
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          progress: null,
        }));
      }
    },
    [getWorker],
  );

  const start = useCallback(
    (source: SourceImage) => {
      setState({
        status: "loading-model",
        source,
        matte: null,
        prompt: null,
        error: null,
        progress: 0,
      });
      post({
        type: "encode",
        source,
      } satisfies SelectObjectWorkerRequest);
    },
    [post],
  );

  const prompt = useCallback(
    (value: SelectionPrompt) => {
      lastPromptRef.current = value;
      setState((current) => ({
        ...current,
        status: "predicting-mask",
        matte: null,
        prompt: value,
        error: null,
      }));
      post({
        type: "prompt",
        prompt: value,
      } satisfies SelectObjectWorkerRequest);
    },
    [post],
  );

  const retry = useCallback(() => {
    if (!workerRef.current && state.source) start(state.source);
    else if (state.status === "error" && lastPromptRef.current && state.source)
      prompt(lastPromptRef.current);
    else if (state.source) start(state.source);
  }, [prompt, start, state.source, state.status]);

  const replacePrompt = useCallback(() => {
    lastPromptRef.current = null;
    setState((current) => ({
      ...current,
      status: current.source ? "ready-for-prompt" : "idle",
      matte: null,
      prompt: null,
      error: null,
      progress: null,
    }));
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.postMessage({ type: "reset" } satisfies SelectObjectWorkerRequest);
    workerRef.current?.terminate();
    workerRef.current = null;
    lastPromptRef.current = null;
    setState(initialState);
  }, []);

  useEffect(() => reset, [reset]);
  return { state, start, prompt, replacePrompt, retry, reset };
}
