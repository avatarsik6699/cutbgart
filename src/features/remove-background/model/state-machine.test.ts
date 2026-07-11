import { describe, expect, it } from "vitest";

import type { ProcessedImage } from "../../../entities/processed-image";
import {
  initialRemoveBackgroundState,
  removeBackgroundReducer,
  type RemoveBackgroundError,
  type RemoveBackgroundState,
} from "./state-machine";

const dummyResult = {} as ProcessedImage;
const dummyError: RemoveBackgroundError = {
  code: "processing-failed",
  message: "boom",
  action: "retry",
};

describe("removeBackgroundReducer", () => {
  it("starts idle", () => {
    expect(initialRemoveBackgroundState).toEqual({ status: "idle" });
  });

  it("walks the full happy path: idle -> model-loading -> ready -> processing -> result", () => {
    let state: RemoveBackgroundState = initialRemoveBackgroundState;

    state = removeBackgroundReducer(state, { type: "SELECT_FILE", qualityMode: "fast" });
    expect(state).toEqual({ status: "model-loading", qualityMode: "fast", progress: 0 });

    state = removeBackgroundReducer(state, { type: "MODEL_PROGRESS", percent: 42 });
    expect(state).toEqual({ status: "model-loading", qualityMode: "fast", progress: 42 });

    state = removeBackgroundReducer(state, { type: "MODEL_READY" });
    expect(state).toEqual({ status: "ready", qualityMode: "fast" });

    state = removeBackgroundReducer(state, { type: "START_PROCESSING" });
    expect(state).toEqual({ status: "processing", qualityMode: "fast" });

    state = removeBackgroundReducer(state, {
      type: "PROCESSING_SUCCEEDED",
      result: dummyResult,
    });
    expect(state).toEqual({ status: "result", result: dummyResult });
  });

  it("reaches error from every state", () => {
    const states: RemoveBackgroundState[] = [
      { status: "idle" },
      { status: "model-loading", qualityMode: "fast", progress: 10 },
      { status: "ready", qualityMode: "fast" },
      { status: "processing", qualityMode: "fast" },
      { status: "result", result: dummyResult },
      { status: "correcting", result: dummyResult },
    ];

    for (const state of states) {
      expect(
        removeBackgroundReducer(state, { type: "FAILED", error: dummyError }),
      ).toEqual({
        status: "error",
        error: dummyError,
      });
    }
  });

  it("RESET always returns to idle", () => {
    const errorState: RemoveBackgroundState = { status: "error", error: dummyError };
    expect(removeBackgroundReducer(errorState, { type: "RESET" })).toEqual({
      status: "idle",
    });

    const resultState: RemoveBackgroundState = { status: "result", result: dummyResult };
    expect(removeBackgroundReducer(resultState, { type: "RESET" })).toEqual({
      status: "idle",
    });
  });

  it("enters correcting from result and returns to result on exit (Phase 07)", () => {
    const resultState: RemoveBackgroundState = { status: "result", result: dummyResult };

    const correcting = removeBackgroundReducer(resultState, { type: "ENTER_CORRECTING" });
    expect(correcting).toEqual({ status: "correcting", result: dummyResult });

    const correctedResult = { ...dummyResult, qualityMode: "max" } as ProcessedImage;
    const backToResult = removeBackgroundReducer(correcting, {
      type: "EXIT_CORRECTING",
      result: correctedResult,
    });
    expect(backToResult).toEqual({ status: "result", result: correctedResult });
  });

  it("ignores actions that don't apply to correcting or result w.r.t. correcting transitions", () => {
    const resultState: RemoveBackgroundState = { status: "result", result: dummyResult };
    expect(
      removeBackgroundReducer(resultState, {
        type: "EXIT_CORRECTING",
        result: dummyResult,
      }),
    ).toBe(resultState);

    const correctingState: RemoveBackgroundState = {
      status: "correcting",
      result: dummyResult,
    };
    expect(removeBackgroundReducer(correctingState, { type: "ENTER_CORRECTING" })).toBe(
      correctingState,
    );
  });

  it("allows re-entering model-loading from result (recompute in a different quality mode)", () => {
    const resultState: RemoveBackgroundState = { status: "result", result: dummyResult };

    const next = removeBackgroundReducer(resultState, {
      type: "SELECT_FILE",
      qualityMode: "max",
    });

    expect(next).toEqual({ status: "model-loading", qualityMode: "max", progress: 0 });
  });

  it("ignores actions that don't apply to the current state", () => {
    const idleState: RemoveBackgroundState = { status: "idle" };
    expect(removeBackgroundReducer(idleState, { type: "MODEL_READY" })).toBe(idleState);

    const readyState: RemoveBackgroundState = { status: "ready", qualityMode: "fast" };
    expect(
      removeBackgroundReducer(readyState, { type: "MODEL_PROGRESS", percent: 5 }),
    ).toBe(readyState);
  });
});
