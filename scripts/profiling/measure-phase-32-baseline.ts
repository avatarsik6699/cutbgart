import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Page } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const port = 4175;
const rootUrl = `http://127.0.0.1:${String(port)}`;
const sampleImage = path.join(projectRoot, "e2e/fixtures/sample.jpg");

type BrowserMeasurements = {
  longTasks: number[];
  workerMessages: Record<string, number>;
};

function startServer(): ChildProcess {
  return spawn("node", [".output/server/index.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
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
      const response = await fetch(`${rootUrl}/favicon.ico`, {
        signal: AbortSignal.timeout(1_000),
      });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      // Retry until the production server accepts requests.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${rootUrl} did not become ready in time`);
}

async function installMeasurementHooks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const measurements: BrowserMeasurements = {
      longTasks: [],
      workerMessages: {},
    };
    (
      window as unknown as {
        __phase32Measurements: BrowserMeasurements;
      }
    ).__phase32Measurements = measurements;

    const NativeWorker = window.Worker;
    class MeasuredWorker extends NativeWorker {
      override postMessage(message: unknown, transfer: Transferable[]): void;
      override postMessage(message: unknown, options?: StructuredSerializeOptions): void;
      override postMessage(
        message: unknown,
        options?: Transferable[] | StructuredSerializeOptions,
      ): void {
        const type =
          typeof message === "object" && message !== null && "type" in message
            ? String(message.type)
            : "unknown";
        measurements.workerMessages[type] = (measurements.workerMessages[type] ?? 0) + 1;
        if (Array.isArray(options)) super.postMessage(message, options);
        else super.postMessage(message, options);
      }
    }
    window.Worker = MeasuredWorker;

    try {
      const observer = new PerformanceObserver((list) => {
        measurements.longTasks.push(...list.getEntries().map((entry) => entry.duration));
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Chromium normally exposes longtask; keep the collection empty if not.
    }
  });
}

async function nextPaintLatency(
  page: Page,
  action: () => Promise<void>,
): Promise<number> {
  await page.evaluate(() => {
    performance.mark("phase32-action-start");
  });
  await action();
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(
              performance.now() -
                performance.getEntriesByName("phase32-action-start").at(-1)!.startTime,
            );
          });
        });
      }),
  );
}

async function main(): Promise<void> {
  const server = startServer();
  const browser = await chromium.launch();
  try {
    await waitForServer(server);
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await installMeasurementHooks(page);
    await page.goto(`${rootUrl}/en`, { waitUntil: "load" });
    await page
      .getByLabel("Upload an image")
      .setInputFiles([sampleImage, sampleImage, sampleImage]);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="scheduler-summary"]')
          ?.textContent?.includes("3 done") ?? false,
      undefined,
      { timeout: 180_000 },
    );

    const resultButtons = page.locator("article button[aria-pressed]");
    const beforeSwitch = await page.evaluate(() => ({
      ...(window as unknown as { __phase32Measurements: BrowserMeasurements })
        .__phase32Measurements.workerMessages,
    }));
    const switchLatencies: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      switchLatencies.push(
        await nextPaintLatency(page, async () => {
          await resultButtons.nth(index).click();
        }),
      );
    }
    const measurements = await page.evaluate(
      () =>
        (window as unknown as { __phase32Measurements: BrowserMeasurements })
          .__phase32Measurements,
    );
    const afterSwitch = measurements.workerMessages;
    const processMessagesDuringSwitch =
      (afterSwitch.process ?? 0) - (beforeSwitch.process ?? 0);

    console.log(
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          host: {
            platform: process.platform,
            node: process.version,
          },
          batch: {
            completedItems: await page.getByTestId("batch-item-thumbnail").count(),
            workerMessages: measurements.workerMessages,
            processMessagesDuringCompletedItemSwitch: processMessagesDuringSwitch,
            completedItemSwitchNextPaintMs: switchLatencies,
            longTasksMs: measurements.longTasks,
          },
        },
        null,
        2,
      ),
    );
    await context.close();
  } finally {
    await browser.close();
    server.kill();
  }
}

await main();
