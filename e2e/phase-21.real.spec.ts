import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const SAMPLE =
  process.env.PHASE21_SAMPLE ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icon-512.png");

test.describe.configure({ mode: "serial", timeout: 12 * 60_000 });

async function brushStroke(
  page: Page,
  mode: "Keep" | "Remove",
  from: readonly [number, number],
  to: readonly [number, number],
): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`^${mode}$`) }).click();
  const image = page.getByRole("img", {
    name: /brush-guided object correction/i,
  });
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Magic image has no bounding box");
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1]);
  await page.mouse.up();
}

function readCount(value: string | null): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0)
    throw new Error("Runtime prompt count was unavailable");
  return count;
}

async function observeRecompositeDeltas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__guidedRecompositeDeltas", {
      configurable: true,
      writable: true,
      value: null,
    });
    const NativeWorker = window.Worker;
    const ObservedWorker = new Proxy(NativeWorker, {
      construct(Target, args) {
        const worker = Reflect.construct(Target, args) as Worker;
        const nativePostMessage = worker.postMessage.bind(worker);
        worker.postMessage = ((message: unknown, ...rest: unknown[]) => {
          const request = message as {
            type?: string;
            image?: { alphaMatte?: { data: Uint8ClampedArray } };
            matte?: { data: Uint8ClampedArray };
          };
          const prior = request.image?.alphaMatte?.data;
          const next = request.matte?.data;
          if (
            request.type === "recomposite" &&
            prior &&
            next &&
            prior.length === next.length
          ) {
            let matteLossCount = 0;
            let matteGainCount = 0;
            for (let index = 0; index < next.length; index += 1) {
              if (next[index]! < prior[index]!) matteLossCount += 1;
              else if (next[index]! > prior[index]!) matteGainCount += 1;
            }
            (
              window as unknown as {
                __guidedRecompositeDeltas: {
                  matteLossCount: number;
                  matteGainCount: number;
                };
              }
            ).__guidedRecompositeDeltas = { matteLossCount, matteGainCount };
          }
          Reflect.apply(nativePostMessage, worker, [message, ...rest]);
        }) as Worker["postMessage"];
        return worker;
      },
    });
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: ObservedWorker,
    });
  });
}

async function readRecompositeDeltas(
  page: Page,
): Promise<{ matteLossCount: number; matteGainCount: number }> {
  const deltas = await page.evaluate(
    () =>
      (
        window as unknown as {
          __guidedRecompositeDeltas: {
            matteLossCount: number;
            matteGainCount: number;
          } | null;
        }
      ).__guidedRecompositeDeltas,
  );
  if (!deltas) throw new Error("Recomposite alpha deltas were unavailable");
  return deltas;
}

async function openRealMagic(page: Page) {
  await observeRecompositeDeltas(page);
  await page.goto("/en/");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  const guided = page.getByTestId("guided-brush-selection");
  await expect(guided).toBeVisible({ timeout: 4 * 60_000 });
  await expect(page.getByRole("button", { name: /^Keep$/ })).toBeEnabled({
    timeout: 4 * 60_000,
  });
  return guided;
}

test("Phase 21 real SlimSAM mixed-intent Cutout Apply stays bounded", async ({
  page,
  browserName,
}) => {
  test.skip(process.env.E2E_PHASE21_REAL !== "1", "opt-in host-only runtime check");
  const started = Date.now();
  const guided = await openRealMagic(page);
  const workspace = page.getByTestId("tool-workspace");
  await brushStroke(page, "Keep", [0.25, 0.35], [0.4, 0.65]);
  await brushStroke(page, "Remove", [0.65, 0.4], [0.78, 0.6]);
  await expect(guided).not.toHaveAttribute("data-prompt-count", /\d+/);

  const inferenceStarted = Date.now();
  await page.getByRole("button", { name: /^Apply$/ }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "1", {
    timeout: 3 * 60_000,
  });
  await expect(guided).toHaveAttribute("data-stroke-count", "0");

  const total = readCount(await guided.getAttribute("data-prompt-count"));
  const keep = readCount(await guided.getAttribute("data-prompt-keep-count"));
  const remove = readCount(await guided.getAttribute("data-prompt-remove-count"));
  expect(total).toBeLessThanOrEqual(32);
  expect(keep).toBeGreaterThan(0);
  expect(remove).toBeGreaterThan(0);
  expect(Math.abs(keep - remove)).toBeLessThanOrEqual(1);
  console.log(
    `[phase-21-real] ${JSON.stringify({
      flow: "automatic-base-mixed-intent",
      browserName,
      runtimePath: "automatic-available-path + SlimSAM-wasm",
      promptCount: total,
      keepPromptCount: keep,
      removePromptCount: remove,
      explicitApplyOnly: true,
      committedDocument: true,
      inferenceMs: Date.now() - inferenceStarted,
      durationMs: Date.now() - started,
      failure: "none",
    })}`,
  );
});

test("Phase 27 real automatic-base Keep never loses existing foreground", async ({
  page,
  browserName,
}) => {
  test.skip(process.env.E2E_PHASE21_REAL !== "1", "opt-in host-only runtime check");
  const started = Date.now();
  const guided = await openRealMagic(page);
  const workspace = page.getByTestId("tool-workspace");
  await brushStroke(page, "Keep", [0.3, 0.4], [0.48, 0.62]);

  const inferenceStarted = Date.now();
  await page.getByRole("button", { name: /^Apply$/ }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "1", {
    timeout: 3 * 60_000,
  });
  await expect(guided).toHaveAttribute("data-stroke-count", "0");

  const total = readCount(await guided.getAttribute("data-prompt-count"));
  const keep = readCount(await guided.getAttribute("data-prompt-keep-count"));
  const remove = readCount(await guided.getAttribute("data-prompt-remove-count"));
  const deltas = await readRecompositeDeltas(page);
  expect(total).toBeLessThanOrEqual(32);
  expect(keep).toBeGreaterThan(0);
  expect(remove).toBe(0);
  expect(deltas.matteLossCount).toBe(0);
  console.log(
    `[phase-21-real] ${JSON.stringify({
      flow: "automatic-base-keep-directional",
      browserName,
      runtimePath: "automatic-available-path + SlimSAM-wasm",
      promptCount: total,
      keepPromptCount: keep,
      removePromptCount: remove,
      unwantedForegroundLoss: deltas.matteLossCount,
      foregroundGain: deltas.matteGainCount,
      explicitApplyOnly: true,
      committedDocument: true,
      inferenceMs: Date.now() - inferenceStarted,
      durationMs: Date.now() - started,
      failure: "none",
    })}`,
  );
});

test("Phase 21 real automatic-base Cutout Apply accepts red-only intent", async ({
  page,
  browserName,
}) => {
  test.skip(process.env.E2E_PHASE21_REAL !== "1", "opt-in host-only runtime check");
  const started = Date.now();
  const guided = await openRealMagic(page);
  const workspace = page.getByTestId("tool-workspace");
  await brushStroke(page, "Remove", [0.6, 0.35], [0.75, 0.65]);

  const inferenceStarted = Date.now();
  await page.getByRole("button", { name: /^Apply$/ }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "1", {
    timeout: 3 * 60_000,
  });
  await expect(guided).toHaveAttribute("data-stroke-count", "0");

  const total = readCount(await guided.getAttribute("data-prompt-count"));
  const keep = readCount(await guided.getAttribute("data-prompt-keep-count"));
  const remove = readCount(await guided.getAttribute("data-prompt-remove-count"));
  const deltas = await readRecompositeDeltas(page);
  expect(total).toBeLessThanOrEqual(32);
  expect(keep).toBe(0);
  expect(remove).toBeGreaterThan(0);
  expect(deltas.matteGainCount).toBe(0);
  console.log(
    `[phase-21-real] ${JSON.stringify({
      flow: "automatic-base-red-only",
      browserName,
      runtimePath: "automatic-available-path + SlimSAM-wasm",
      promptCount: total,
      keepPromptCount: keep,
      removePromptCount: remove,
      foregroundLoss: deltas.matteLossCount,
      unwantedForegroundGain: deltas.matteGainCount,
      explicitApplyOnly: true,
      committedDocument: true,
      inferenceMs: Date.now() - inferenceStarted,
      durationMs: Date.now() - started,
      failure: "none",
    })}`,
  );
});
