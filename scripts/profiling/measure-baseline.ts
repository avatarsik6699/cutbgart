import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type CDPSession, type Page } from "@playwright/test";
import { expectAutomaticCutout } from "../../e2e/support/editor-ui";
import { installMockInference } from "../../e2e/support/mock-inference";

/**
 * PHASE_31 T2 profiling harness. Serves the real production build
 * (`.output/server`, built beforehand via `pnpm build`) and drives it with
 * Playwright + a raw CDP session for `Performance.getMetrics()` (JS heap)
 * and a `PerformanceObserver` for long tasks. Uses the same deterministic
 * mocked-worker double as `pnpm e2e` (`installMockInference`) so results
 * reflect React/DOM/resource-lifecycle cost, not real ONNX inference time —
 * intentionally, since T5's leak-detection question is about this project's
 * own cleanup code, not model runtime.
 *
 * Single-machine, single-run data points (SPEC.md §7.1) — not a universal
 * device claim. Run repeatedly and compare trends, not one-shot absolutes.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = 4174;
const ROOT_URL = `http://127.0.0.1:${String(PORT)}`;
const SAMPLE_IMAGE = path.join(ROOT, "e2e/fixtures/sample.jpg");

interface LongTaskSample {
  count: number;
  totalDurationMs: number;
}

interface ChurnIterationMetrics {
  iteration: number;
  jsHeapUsedBytes: number;
  longTasks: LongTaskSample;
  wallClockMs: number;
}

function startServer(): ChildProcess {
  return spawn("node", [".output/server/index.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1" },
    stdio: "pipe",
  });
}

async function waitForServer(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited before ready (${String(server.exitCode)})`);
    }
    try {
      const response = await fetch(`${ROOT_URL}/favicon.ico`, {
        signal: AbortSignal.timeout(1_000),
      });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${ROOT_URL} did not become ready in time`);
}

async function installLongTaskObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as { __longTasks: PerformanceEntry[] };
    win.__longTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        win.__longTasks.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // longtask entry type unsupported in this browser; leave the array empty.
    }
  });
}

async function readLongTasks(page: Page): Promise<LongTaskSample> {
  return page.evaluate(() => {
    const win = window as unknown as { __longTasks: PerformanceEntry[] };
    const entries = win.__longTasks ?? [];
    return {
      count: entries.length,
      totalDurationMs: entries.reduce((sum, entry) => sum + entry.duration, 0),
    };
  });
}

async function clearLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks = [];
  });
}

async function heapUsedBytes(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
}

async function runSingleUploadChurn(
  page: Page,
  cdp: CDPSession,
  iterations: number,
): Promise<ChurnIterationMetrics[]> {
  const results: ChurnIterationMetrics[] = [];
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    await clearLongTasks(page);
    const started = Date.now();

    await page.getByLabel("Upload an image").setInputFiles(SAMPLE_IMAGE);
    await expectAutomaticCutout(page);

    await page.getByRole("button", { name: /back to upload/i }).click();
    await page.getByLabel("Upload an image").waitFor({ state: "visible" });

    // Force a GC pass via CDP before measuring, so heap comparisons reflect
    // retained (leaked) memory, not just not-yet-collected garbage.
    await cdp.send("HeapProfiler.collectGarbage");
    const jsHeapUsedBytes = await heapUsedBytes(cdp);
    const longTasks = await readLongTasks(page);
    results.push({
      iteration,
      jsHeapUsedBytes,
      longTasks,
      wallClockMs: Date.now() - started,
    });
  }
  return results;
}

async function runBatchChurn(
  page: Page,
  cdp: CDPSession,
  iterations: number,
): Promise<ChurnIterationMetrics[]> {
  const results: ChurnIterationMetrics[] = [];
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    await clearLongTasks(page);
    const started = Date.now();

    await page
      .getByLabel("Upload an image")
      .setInputFiles([SAMPLE_IMAGE, SAMPLE_IMAGE, SAMPLE_IMAGE]);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="scheduler-summary"]')
          ?.textContent?.includes("3 done") ?? false,
      undefined,
      { timeout: 15_000 },
    );
    // Clear the whole batch item by item via each card's "Remove image"
    // action, back to the empty upload surface — the actual user-reachable
    // teardown path, not a hook-internal reset call.
    while ((await page.getByTestId("batch-item-actions").count()) > 0) {
      await page.getByTestId("batch-item-actions").first().click();
      await page.getByRole("menuitem", { name: /^Remove image$/ }).click();
    }
    await page.getByLabel("Upload an image").waitFor({ state: "visible" });

    await cdp.send("HeapProfiler.collectGarbage");
    const jsHeapUsedBytes = await heapUsedBytes(cdp);
    const longTasks = await readLongTasks(page);
    results.push({
      iteration,
      jsHeapUsedBytes,
      longTasks,
      wallClockMs: Date.now() - started,
    });
  }
  return results;
}

async function preparePage(page: Page): Promise<void> {
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("CONSOLE ERROR", msg.text());
  });
  page.on("pageerror", (error) => console.error("PAGE ERROR", error));
  // `tsx`'s esbuild transform injects a module-scoped `__name` helper for
  // class declarations (name-preservation). `page.addInitScript` only
  // serializes the function body via `toString()`, not the enclosing
  // module, so that helper is missing at runtime here (unlike inside
  // Playwright's own test runner, which transforms this differently).
  // Defining a no-op global first, before `installMockInference`'s
  // `MockInferenceWorker` class declaration runs, resolves it.
  await page.addInitScript(() => {
    (window as unknown as { __name?: unknown }).__name ??= (target: unknown) => target;
  });
  await installMockInference(page);
}

async function main(): Promise<void> {
  const server = startServer();
  const browser = await chromium.launch();
  try {
    await waitForServer(server);
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await preparePage(page);

    // --- Cold start (S1) ---
    const coldStart = Date.now();
    await page.goto(`${ROOT_URL}/en`, { waitUntil: "load" });
    const coldLoadMs = Date.now() - coldStart;
    const paintMetrics = await page.evaluate(() => {
      const paint = performance.getEntriesByType("paint");
      return {
        fcp:
          paint.find((entry) => entry.name === "first-contentful-paint")?.startTime ??
          null,
      };
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await installLongTaskObserver(page);

    // --- Repeated single-upload churn (S2, resource-lifecycle trend, T5) ---
    // 40 is enough to see the growth-rate deceleration pattern; bump to 100+
    // for a more conclusive read when investigating a specific suspected leak.
    const churn = await runSingleUploadChurn(page, cdp, 40);

    // Fresh page for batch churn so its heap baseline isn't inflated by the
    // single-upload run above.
    await page.close();
    const batchPage = await context.newPage();
    await preparePage(batchPage);
    await batchPage.goto(`${ROOT_URL}/en`, { waitUntil: "load" });
    const batchCdp = await context.newCDPSession(batchPage);
    await batchCdp.send("Performance.enable");
    await installLongTaskObserver(batchPage);
    const batchChurn = await runBatchChurn(batchPage, batchCdp, 40);

    const report = {
      capturedAt: new Date().toISOString(),
      coldStart: { loadMs: coldLoadMs, firstContentfulPaintMs: paintMetrics.fcp },
      singleUploadChurn: churn,
      batchChurn,
    };
    console.log(JSON.stringify(report, null, 2));

    await context.close();
  } finally {
    await browser.close();
    server.kill();
  }
}

await main();
