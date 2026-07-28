import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { expectAutomaticCutout } from "./support/editor-ui";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.skip(!process.env.E2E_PHASE19_REAL, "opt-in real Phase 19 runtime evidence");

test("real Phase 19 refinement: current enhancement path, hard constraints, and disposal", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "__phase19Trace", {
      configurable: true,
      value: {
        requests: [] as Array<{ type: string; requestId?: string; mode?: string }>,
        responses: [] as Array<{ type: string; requestId?: string }>,
        results: [] as Array<{
          actualMode: string;
          actualPath: string | null;
          fallback: string;
          fallbackReason?: string;
          constrainedAlpha: number;
        }>,
      },
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked through Reflect.apply with the concrete Worker receiver below.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      const typed = message as {
        type?: string;
        requestId?: string;
        request?: {
          requestId: string;
          requestedMode: string;
          constraints: { data: Int8Array } | null;
          trimap: { data: Uint8ClampedArray };
        };
      };
      const trace = (
        window as unknown as {
          __phase19Trace: {
            requests: Array<{ type: string; requestId?: string; mode?: string }>;
            results: unknown[];
          };
        }
      ).__phase19Trace;
      trace.requests.push({
        type: typed.type ?? "unknown",
        requestId: typed.request?.requestId ?? typed.requestId,
        mode: typed.request?.requestedMode,
      });
      if (typed.type === "refine" && typed.request) {
        typed.request.constraints ??= {
          data: new Int8Array(typed.request.trimap.data.length).fill(-1),
        };
        typed.request.constraints.data[0] = 1;
      }
      Reflect.apply(
        nativePostMessage,
        this,
        options === undefined ? [message] : [message, options],
      );
      return;
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked through Reflect.apply with the concrete Worker receiver below.
    const nativeAddEventListener = Worker.prototype.addEventListener;
    Worker.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === "message") {
        const wrapped: EventListener = (event) => {
          const data = (event as MessageEvent).data as {
            type?: string;
            requestId?: string;
            result?: {
              matte: { data: Uint8ClampedArray };
              actualMode: string;
              actualPath: string | null;
              fallback: string;
              fallbackReason?: string;
            };
          };
          const trace = (
            window as unknown as {
              __phase19Trace: {
                responses: Array<{ type: string; requestId?: string }>;
                results: Array<{
                  actualMode: string;
                  actualPath: string | null;
                  fallback: string;
                  fallbackReason?: string;
                  constrainedAlpha: number;
                }>;
              };
            }
          ).__phase19Trace;
          trace.responses.push({
            type: data.type ?? "unknown",
            requestId: data.requestId,
          });
          if (data.type === "result" && data.result) {
            trace.results.push({
              actualMode: data.result.actualMode,
              actualPath: data.result.actualPath,
              fallback: data.result.fallback,
              fallbackReason: data.result.fallbackReason,
              constrainedAlpha: data.result.matte.data[0] ?? -1,
            });
          }
          if (typeof listener === "function") listener.call(this, event);
          else listener.handleEvent(event);
        };
        Reflect.apply(nativeAddEventListener, this, [type, wrapped, options]);
        return;
      }
      Reflect.apply(nativeAddEventListener, this, [type, listener, options]);
      return;
    };
  });

  const vitmatteResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("vitmatte-small-distinctions-646")) {
      vitmatteResponses.push(response.url());
    }
  });

  await page.goto("/en");
  await expect(page.getByLabel("Upload an image")).toBeEnabled();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  await expectAutomaticCutout(page, {
    timeout: 180_000,
  });
  await page.getByRole("button", { name: "Enhancements" }).click();
  const controls = page.getByTestId("enhancements-tool-panel");
  await controls.getByRole("checkbox", { name: /Remove colour halo/i }).uncheck();
  const observations: Array<{ mode: string; elapsedMs: number }> = [];
  const startedAt = Date.now();
  const previousResultCount = await page.evaluate(
    () =>
      (window as unknown as { __phase19Trace: { results: unknown[] } }).__phase19Trace
        .results.length,
  );
  await controls.getByRole("button", { name: /^Apply$/ }).click();
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __phase19Trace: { results: unknown[] } })
                .__phase19Trace.results.length,
          ),
        { timeout: 180_000 },
      )
      .toBe(previousResultCount + 1);
  } catch (error) {
    console.log(
      "[phase-19-timeout-trace]",
      JSON.stringify(await page.evaluate(() => (window as never)["__phase19Trace"])),
    );
    throw error;
  }
  const latestResult = await page.evaluate(() =>
    (
      window as unknown as {
        __phase19Trace: { results: Array<{ actualMode: string }> };
      }
    ).__phase19Trace.results.at(-1),
  );
  console.log("[phase-19-observation]", JSON.stringify({ latestResult }));
  await expect(controls.getByRole("button", { name: /^Apply$/ })).toBeVisible({
    timeout: 180_000,
  });
  observations.push({
    mode: latestResult?.actualMode ?? "unknown",
    elapsedMs: Date.now() - startedAt,
  });

  const disposedBeforeReset = await page.evaluate(
    () =>
      (
        window as unknown as {
          __phase19Trace: { responses: Array<{ type: string }> };
        }
      ).__phase19Trace.responses.filter((response) => response.type === "disposed")
        .length,
  );
  await page.getByRole("button", { name: "Process another image" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __phase19Trace: { responses: Array<{ type: string }> };
              }
            ).__phase19Trace.responses.filter((response) => response.type === "disposed")
              .length,
        ),
      { timeout: 30_000 },
    )
    .toBe(disposedBeforeReset + 1);

  const trace = await page.evaluate(
    () =>
      (
        window as unknown as {
          __phase19Trace: {
            requests: Array<{ type: string; requestId?: string; mode?: string }>;
            responses: Array<{ type: string; requestId?: string }>;
            results: Array<{
              actualMode: string;
              actualPath: string | null;
              fallback: string;
              fallbackReason?: string;
              constrainedAlpha: number;
            }>;
          };
        }
      ).__phase19Trace,
  );
  console.log(
    "[phase-19-real]",
    JSON.stringify(
      {
        observations,
        results: trace.results,
        requestedGraphs: [
          ...new Set(vitmatteResponses.filter((url) => url.endsWith(".onnx"))),
        ],
        peakMemoryBytes: null,
        memoryObservation: "unavailable",
      },
      null,
      2,
    ),
  );
  expect(trace.results).toHaveLength(1);
  expect(trace.results.every((result) => result.constrainedAlpha === 255)).toBe(true);
  const requestedModes = trace.requests
    .filter((request) => request.type === "refine")
    .map((request) => request.mode);
  expect(requestedModes).toHaveLength(1);
  expect(["balanced", "maximum"]).toContain(requestedModes[0]);
  expect(
    vitmatteResponses.some(
      (url) => url.endsWith("model_quantized.onnx") || url.endsWith("model.onnx"),
    ),
  ).toBe(true);
});
