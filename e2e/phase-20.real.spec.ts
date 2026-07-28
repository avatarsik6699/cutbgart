import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { computeMattingInputSize } from "../src/features/refine-matte";
import { FOREGROUND_RUNTIME_THRESHOLDS } from "../src/features/refine-foreground";
import { expectAutomaticCutout } from "./support/editor-ui";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.skip(!process.env.E2E_PHASE20_REAL, "opt-in real Phase 20 runtime evidence");

test("real Phase 20 hybrid pipeline and bounded large-input refinement", async ({
  page,
}) => {
  test.setTimeout(12 * 60_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "__phase20Trace", {
      configurable: true,
      value: {
        requests: [] as Array<Record<string, unknown>>,
        matteResults: [] as Array<Record<string, unknown>>,
        foregroundResults: [] as Array<Record<string, unknown>>,
      },
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with the Worker receiver.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      const typed = message as {
        type?: string;
        request?: {
          requestedMode?: string;
          requestedPath?: string;
          inputSize?: { width: number; height: number };
          crop?: { width: number; height: number };
        };
      };
      if (typed.type === "refine" || typed.type === "refine-foreground") {
        (
          window as unknown as {
            __phase20Trace: { requests: Array<Record<string, unknown>> };
          }
        ).__phase20Trace.requests.push({
          type: typed.type,
          mode: typed.request?.requestedMode,
          path: typed.request?.requestedPath,
          inputSize: typed.request?.inputSize,
          crop: typed.request?.crop,
        });
      }
      Reflect.apply(
        nativePostMessage,
        this,
        options === undefined ? [message] : [message, options],
      );
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with the Worker receiver.
    const nativeAddEventListener = Worker.prototype.addEventListener;
    Worker.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type !== "message") {
        Reflect.apply(nativeAddEventListener, this, [type, listener, options]);
        return;
      }
      const wrapped: EventListener = (event) => {
        const data = (event as MessageEvent).data as {
          type?: string;
          result?: {
            requestedMode?: string;
            actualMode?: string;
            actualPath?: string | null;
            inputSize?: { width: number; height: number };
            fallback?: string;
            requestedPath?: string;
            durationMs?: number;
            memoryBytes?: number | "unavailable";
            matte?: { width: number; height: number };
          };
        };
        const trace = (
          window as unknown as {
            __phase20Trace: {
              matteResults: Array<Record<string, unknown>>;
              foregroundResults: Array<Record<string, unknown>>;
            };
          }
        ).__phase20Trace;
        if (data.type === "result" && data.result?.requestedMode) {
          trace.matteResults.push({
            requestedMode: data.result.requestedMode,
            actualMode: data.result.actualMode,
            actualPath: data.result.actualPath,
            inputSize: data.result.inputSize,
            fallback: data.result.fallback,
            matte: data.result.matte
              ? { width: data.result.matte.width, height: data.result.matte.height }
              : null,
          });
        } else if (
          data.type === "result" &&
          data.result?.requestedPath === "decontaminate"
        ) {
          trace.foregroundResults.push({
            actualPath: data.result.actualPath,
            fallback: data.result.fallback,
            durationMs: data.result.durationMs,
            memoryBytes: data.result.memoryBytes,
          });
        }
        if (typeof listener === "function") listener.call(this, event);
        else listener.handleEvent(event);
      };
      Reflect.apply(nativeAddEventListener, this, [type, wrapped, options]);
    };
  });

  await page.goto("/en");
  const automaticStartedAt = Date.now();
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page, {
    timeout: FOREGROUND_RUNTIME_THRESHOLDS.automaticMs,
  });
  const automaticMs = Date.now() - automaticStartedAt;

  await page.getByRole("button", { name: "Enhancements" }).click();
  const enhancements = page.getByTestId("enhancements-tool-panel");
  const refinementObservations: Array<{
    mode: "balanced" | "maximum";
    warm: boolean;
    elapsedMs: number;
  }> = [];
  const enhancementStartedAt = Date.now();
  await enhancements.getByRole("button", { name: /^Apply$/ }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __phase20Trace: { matteResults: unknown[] };
              }
            ).__phase20Trace.matteResults.length,
        ),
      { timeout: FOREGROUND_RUNTIME_THRESHOLDS.coldRefinementMs },
    )
    .toBe(1);
  const refinementElapsedMs = Date.now() - enhancementStartedAt;
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __phase20Trace: { foregroundResults: unknown[] };
              }
            ).__phase20Trace.foregroundResults.length,
        ),
      {
        timeout:
          FOREGROUND_RUNTIME_THRESHOLDS.coldRefinementMs +
          FOREGROUND_RUNTIME_THRESHOLDS.cleanupMs,
      },
    )
    .toBe(1);
  const cleanupMs = Date.now() - enhancementStartedAt - refinementElapsedMs;
  const requestedMode = await page.evaluate(
    () =>
      (
        window as unknown as {
          __phase20Trace: {
            requests: Array<{ type?: string; mode?: "balanced" | "maximum" }>;
          };
        }
      ).__phase20Trace.requests.find((request) => request.type === "refine")?.mode,
  );
  if (!requestedMode) throw new Error("Enhancements did not start fine-detail work");
  refinementObservations.push({
    mode: requestedMode,
    warm: false,
    elapsedMs: refinementElapsedMs,
  });
  expect(refinementElapsedMs).toBeLessThanOrEqual(
    FOREGROUND_RUNTIME_THRESHOLDS.coldRefinementMs,
  );

  const largeInputSize = computeMattingInputSize({ width: 2500, height: 2500 });
  const largeObservation = await page.evaluate(
    async ({ inputSize, timeoutMs }) => {
      const width = 2500;
      const height = 2500;
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Large-input 2D context unavailable");
      context.fillStyle = "#E2E2E2";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#2A70B8";
      context.fillRect(250, 250, 2000, 2000);
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const alpha = new Uint8ClampedArray(width * height).fill(128);
      const worker = new Worker(
        "/src/features/refine-matte/worker/refine-matte.worker.ts",
        { type: "module" },
      );
      const startedAt = performance.now();
      try {
        return await new Promise<Record<string, unknown>>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            reject(new Error("Bounded large-input refinement timed out"));
          }, timeoutMs);
          worker.addEventListener("message", (event) => {
            const message = event.data as {
              type: string;
              error?: unknown;
              result?: {
                actualMode: string;
                actualPath: string | null;
                inputSize: { width: number; height: number };
                fallback: string;
                matte: { width: number; height: number };
              };
            };
            if (message.type === "error") {
              window.clearTimeout(timeout);
              reject(new Error(JSON.stringify(message.error)));
            } else if (message.type === "result" && message.result) {
              window.clearTimeout(timeout);
              resolve({
                elapsedMs: performance.now() - startedAt,
                actualMode: message.result.actualMode,
                actualPath: message.result.actualPath,
                inputSize: message.result.inputSize,
                fallback: message.result.fallback,
                matte: {
                  width: message.result.matte.width,
                  height: message.result.matte.height,
                },
              });
            }
          });
          worker.postMessage({
            type: "refine",
            request: {
              requestId: "phase-20-large-generated",
              source: { blob, width, height, format: "image/png" },
              priorMatte: { width, height, data: alpha.slice() },
              guidedMatte: null,
              constraints: null,
              trimap: {
                width,
                height,
                data: alpha,
                unknownBounds: { x: 0, y: 0, width, height },
              },
              crop: { x: 0, y: 0, width, height },
              inputSize,
              requestedMode: "balanced",
              requestedPath: "wasm",
            },
          });
        });
      } finally {
        worker.terminate();
      }
    },
    {
      inputSize: largeInputSize,
      timeoutMs: FOREGROUND_RUNTIME_THRESHOLDS.coldRefinementMs,
    },
  );

  expect(largeInputSize).toEqual({ width: 1024, height: 1024 });
  expect(largeObservation).toMatchObject({
    actualMode: "balanced",
    actualPath: "wasm",
    inputSize: { width: 1024, height: 1024 },
    fallback: "none",
    matte: { width: 2500, height: 2500 },
  });
  expect(largeObservation.elapsedMs).toBeLessThanOrEqual(
    FOREGROUND_RUNTIME_THRESHOLDS.coldRefinementMs,
  );
  expect(cleanupMs).toBeLessThanOrEqual(FOREGROUND_RUNTIME_THRESHOLDS.cleanupMs);
  expect(automaticMs).toBeLessThanOrEqual(FOREGROUND_RUNTIME_THRESHOLDS.automaticMs);

  const trace = await page.evaluate(
    () => (window as unknown as { __phase20Trace: unknown }).__phase20Trace,
  );
  console.log(
    "[phase-20-real]",
    JSON.stringify(
      {
        requestedPath: "wasm",
        automaticMs,
        refinementObservations,
        cleanupMs,
        largeObservation,
        interactionCount: 1,
        thresholdResult: "pass",
        memoryObservation: "unavailable-or-worker-measured-delta",
        trace,
      },
      null,
      2,
    ),
  );
});
