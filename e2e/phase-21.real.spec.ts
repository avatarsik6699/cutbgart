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
  if (!box) throw new Error("Guided brush image has no bounding box");
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

test("Phase 21 real SlimSAM direct brush prompts stay bounded", async ({
  page,
  browserName,
}) => {
  test.skip(process.env.E2E_PHASE21_REAL !== "1", "opt-in host-only runtime check");
  const started = Date.now();
  await page.goto("/en");
  await page.getByRole("button", { name: /Guide with a brush/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  const guided = page.getByTestId("guided-brush-selection");
  await expect(guided.getByText(/Paint Keep or Remove/)).toBeVisible({
    timeout: 4 * 60_000,
  });
  await brushStroke(page, "Keep", [0.25, 0.35], [0.4, 0.65]);
  await brushStroke(page, "Remove", [0.65, 0.4], [0.78, 0.6]);
  await expect(guided).not.toHaveAttribute("data-prompt-count", /\d+/);
  const inferenceStarted = Date.now();
  await page.getByRole("button", { name: /Recompute mask/ }).click();
  await expect(page.getByTestId("guided-brush-candidates")).toBeVisible({
    timeout: 3 * 60_000,
  });
  const total = readCount(await guided.getAttribute("data-prompt-count"));
  const keep = readCount(await guided.getAttribute("data-prompt-keep-count"));
  const remove = readCount(await guided.getAttribute("data-prompt-remove-count"));
  expect(total).toBeLessThanOrEqual(32);
  expect(keep).toBeGreaterThan(0);
  expect(remove).toBeGreaterThan(0);
  expect(Math.abs(keep - remove)).toBeLessThanOrEqual(1);
  const candidateCount = readCount(
    await page
      .getByTestId("guided-brush-candidates")
      .getAttribute("data-candidate-count"),
  );
  expect(candidateCount).toBeGreaterThanOrEqual(1);
  expect(candidateCount).toBeLessThanOrEqual(3);
  await page.getByRole("button", { name: /Accept and refine/ }).click();
  await expect(page.getByTestId("matte-refinement-controls")).toBeVisible();
  console.log(
    `[phase-21-real] ${JSON.stringify({
      flow: "direct",
      browserName,
      runtimePath: "wasm",
      promptCount: total,
      keepPromptCount: keep,
      removePromptCount: remove,
      candidateCount,
      explicitRecomputeOnly: true,
      continuedToResultPipeline: true,
      inferenceMs: Date.now() - inferenceStarted,
      durationMs: Date.now() - started,
      failure: "none",
    })}`,
  );
});

test("Phase 21 real automatic-base correction accepts red-only intent", async ({
  page,
  browserName,
}) => {
  test.skip(process.env.E2E_PHASE21_REAL !== "1", "opt-in host-only runtime check");
  const started = Date.now();
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible({
    timeout: 4 * 60_000,
  });
  await page.getByRole("button", { name: /Refine selection with brush/ }).click();
  const guided = page.getByTestId("guided-brush-selection");
  await expect(guided.getByText(/Paint Keep or Remove/)).toBeVisible({
    timeout: 4 * 60_000,
  });
  await brushStroke(page, "Remove", [0.6, 0.35], [0.75, 0.65]);
  const inferenceStarted = Date.now();
  await page.getByRole("button", { name: /Recompute mask/ }).click();
  await expect(page.getByTestId("guided-brush-candidates")).toBeVisible({
    timeout: 3 * 60_000,
  });
  const total = readCount(await guided.getAttribute("data-prompt-count"));
  const keep = readCount(await guided.getAttribute("data-prompt-keep-count"));
  const remove = readCount(await guided.getAttribute("data-prompt-remove-count"));
  expect(total).toBeLessThanOrEqual(32);
  expect(keep).toBe(0);
  expect(remove).toBeGreaterThan(0);
  const candidateCount = readCount(
    await page
      .getByTestId("guided-brush-candidates")
      .getAttribute("data-candidate-count"),
  );
  await page.getByRole("button", { name: /Accept and refine/ }).click();
  await expect(page.getByTestId("matte-refinement-controls")).toBeVisible();
  console.log(
    `[phase-21-real] ${JSON.stringify({
      flow: "automatic-base",
      browserName,
      runtimePath: "automatic-available-path + SlimSAM-wasm",
      promptCount: total,
      keepPromptCount: keep,
      removePromptCount: remove,
      candidateCount,
      explicitRecomputeOnly: true,
      continuedToResultPipeline: true,
      inferenceMs: Date.now() - inferenceStarted,
      durationMs: Date.now() - started,
      failure: "none",
    })}`,
  );
});
