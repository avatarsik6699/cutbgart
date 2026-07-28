import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  applyMagicPass,
  expectAutomaticCutout,
  expectComparisonForTool,
} from "./support/editor-ui";
import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.beforeEach(async ({ page }) => installMockInference(page));

async function automaticResult(page: Page, locale = "/en") {
  await page.goto(locale);
  const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);
  await expectComparisonForTool(page, /^(?:Enhancements|Улучшения)$/);
  return page.getByTestId("enhancements-tool-panel");
}

test("fine-detail refinement remains lazy and serialized behind one Apply", async ({
  page,
}) => {
  const panel = await automaticResult(page);
  await panel.getByRole("checkbox", { name: /remove colour halo/i }).uncheck();
  await expect(panel).not.toContainText(/MB|MiB|WebGPU|WASM|model|graph/i);
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/No safe visible change was needed|Безопасные заметные изменения/i),
  ).toBeVisible();

  const posts = await page.evaluate(
    () =>
      (
        window as unknown as {
          __mockInferencePosts: Array<{ type: string; requestedMode?: string }>;
        }
      ).__mockInferencePosts,
  );
  expect(posts.findIndex((post) => post.type === "dispose")).toBeLessThan(
    posts.findIndex((post) => post.type === "refine"),
  );
  expect(posts.filter((post) => post.type === "refine")).toHaveLength(1);
  expect(posts.filter((post) => post.type === "refine-foreground")).toHaveLength(0);
});

test("capability recommendation stays internal while maximum falls back safely", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: () => Promise.resolve({ features: new Set(["shader-f16"]) }),
      },
    });
    Object.defineProperty(window, "__mockMattingMaximumFailure", {
      configurable: true,
      value: true,
    });
  });
  const panel = await automaticResult(page);
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/Enhancements applied|Улучшения применены/i),
  ).toBeVisible();
  await expect(panel).not.toContainText(/Maximum|Balanced|WASM|WebGPU|fallback/i);

  const refine = await page.evaluate(() =>
    (
      window as unknown as {
        __mockInferencePosts: Array<{ type: string; requestedMode?: string }>;
      }
    ).__mockInferencePosts.find((post) => post.type === "refine"),
  );
  expect(refine?.requestedMode).toBe("maximum");
});

test("deterministic fine-detail no-op can continue to the selected halo operation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "__mockMattingBalancedFailure", {
      configurable: true,
      value: true,
    }),
  );
  const panel = await automaticResult(page, "/");
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/Enhancements applied|Улучшения применены/i),
  ).toBeVisible();
  const posts = await page.evaluate(
    () =>
      (window as unknown as { __mockInferencePosts: Array<{ type: string }> })
        .__mockInferencePosts,
  );
  expect(posts.map(({ type }) => type)).toContain("refine");
  expect(posts.map(({ type }) => type)).toContain("refine-foreground");
});

test("an applied Magic result can enter the same Enhancements transaction", async ({
  page,
}) => {
  await page.goto("/en");
  const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);
  await applyMagicPass(page);
  await page.getByRole("button", { name: /^(?:Enhancements|Улучшения)$/ }).click();
  const panel = page.getByTestId("enhancements-tool-panel");
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/Enhancements applied|Улучшения применены/i),
  ).toBeVisible();
});

test("a settled batch runs fine-detail work only for the selected item", async ({
  page,
}) => {
  await page.goto("/en");
  const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([SAMPLE, SAMPLE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText(/2 done|готово 2/);
  await page
    .getByRole("button", {
      name: /select sample\.jpg for review|выбрать sample\.jpg для просмотра/i,
    })
    .first()
    .click();
  await page.getByRole("button", { name: /^(?:Enhancements|Улучшения)$/ }).click();
  const panel = page.getByTestId("enhancements-tool-panel");
  await panel.getByRole("checkbox", { name: /remove colour halo/i }).uncheck();
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/No safe visible change was needed|Безопасные заметные изменения/i),
  ).toBeVisible();
  const refineCount = await page.evaluate(
    () =>
      (
        window as unknown as { __mockInferencePosts: Array<{ type: string }> }
      ).__mockInferencePosts.filter((post) => post.type === "refine").length,
  );
  expect(refineCount).toBe(1);
});
