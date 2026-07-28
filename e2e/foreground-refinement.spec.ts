import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { applyMagicPass, expectAutomaticCutout } from "./support/editor-ui";
import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.beforeEach(async ({ page }) => installMockInference(page));

async function openEnhancements(page: Page, locale = "/en") {
  await page.goto(locale);
  const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);
  await page
    .getByRole("button", {
      name: /^(?:Enhancements|Улучшения)$/,
    })
    .click();
  return page.getByTestId("enhancements-tool-panel");
}

async function chooseHaloOnly(panel: Locator) {
  await panel
    .getByRole("checkbox", { name: /improve fine details|улучшить мелкие детали/i })
    .uncheck();
}

test("halo removal starts from the original source on every non-accumulating Apply", async ({
  page,
}) => {
  const panel = await openEnhancements(page);
  await chooseHaloOnly(panel);
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/Enhancements applied|Улучшения применены/i),
  ).toBeVisible();
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            __mockInferencePosts: Array<{
              type: string;
              sourceIsOriginal?: boolean;
            }>;
          }
        ).__mockInferencePosts.filter((post) => post.type === "refine-foreground"),
      ),
    )
    .toHaveLength(2);
  const cleanupPosts = await page.evaluate(() =>
    (
      window as unknown as {
        __mockInferencePosts: Array<{
          type: string;
          sourceIsOriginal?: boolean;
        }>;
      }
    ).__mockInferencePosts.filter((post) => post.type === "refine-foreground"),
  );
  expect(cleanupPosts.every((post) => post.sourceIsOriginal)).toBe(true);
});

test("an applied Magic result uses the same plain-language Russian halo operation", async ({
  page,
}) => {
  await page.goto("/");
  const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);
  await applyMagicPass(page);

  await page.getByRole("button", { name: /^(?:Enhancements|Улучшения)$/ }).click();
  const panel = page.getByTestId("enhancements-tool-panel");
  await chooseHaloOnly(panel);
  await expect(panel).not.toContainText(/Пропустить и править кистью|компонент|модель/i);
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/Enhancements applied|Улучшения применены/i),
  ).toBeVisible();
});

test("settled batch applies halo removal only to the selected item", async ({ page }) => {
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
  await chooseHaloOnly(panel);
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/Enhancements applied|Улучшения применены/i),
  ).toBeVisible();
  const count = await page.evaluate(
    () =>
      (
        window as unknown as { __mockInferencePosts: Array<{ type: string }> }
      ).__mockInferencePosts.filter((post) => post.type === "refine-foreground").length,
  );
  expect(count).toBe(1);
});

test("unchanged and recoverable failures preserve the committed result without diagnostics", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__mockForegroundUnchanged", {
      configurable: true,
      value: true,
      writable: true,
    });
  });
  const panel = await openEnhancements(page);
  await chooseHaloOnly(panel);
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(
    panel.getByText(/No safe visible change was needed|Безопасные заметные изменения/i),
  ).toBeVisible();
  await expect(panel.getByText(/private no-soft-edge diagnostic/i)).toHaveCount(0);

  await page.evaluate(() => {
    (
      window as unknown as { __mockForegroundUnchanged: boolean }
    ).__mockForegroundUnchanged = false;
    Object.defineProperty(window, "__mockForegroundFailure", {
      configurable: true,
      writable: true,
      value: true,
    });
  });
  await panel.getByRole("button", { name: /^(?:Apply|Применить)$/ }).click();
  await expect(panel.getByRole("alert")).toContainText(
    /could not be completed|не удалось завершить/i,
  );
  await expect(panel.getByText(/private mock diagnostic/i)).toHaveCount(0);

  await page.evaluate(() => {
    (window as unknown as { __mockForegroundFailure: boolean }).__mockForegroundFailure =
      false;
  });
  await panel.getByRole("button", { name: /Try again|Повторить/i }).click();
  await expect(
    panel.getByText(/Enhancements applied|Улучшения применены/i),
  ).toBeVisible();
});
