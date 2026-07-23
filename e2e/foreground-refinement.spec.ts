import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.beforeEach(async ({ page }) => installMockInference(page));

async function uploadAutomatic(page: import("@playwright/test").Page, locale = "/en") {
  await page.goto(locale);
  const upload = page.getByLabel(
    locale === "/en" ? "Upload an image" : "Загрузить изображения",
  );
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expect(
    page.getByRole("slider", { name: /before\/after|до и после/i }),
  ).toBeVisible();
}

test("automatic result cleans once per request without accumulating colour transforms", async ({
  page,
}) => {
  await uploadAutomatic(page);
  const controls = page.getByTestId("foreground-refinement-controls");
  const components = controls.getByRole("checkbox", {
    name: /remove isolated soft specks/i,
  });
  await components.uncheck();
  await controls.getByRole("button", { name: /^Clean edge colours$/ }).click();
  await expect(controls.getByRole("button", { name: /^Clean again$/ })).toBeVisible();
  await expect(controls.getByText(/cleanup was applied/i)).toBeVisible();
  await controls.getByRole("button", { name: /^Clean again$/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            __mockInferencePosts: Array<{
              type: string;
              componentCleanup?: boolean;
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
          componentCleanup?: boolean;
          sourceIsOriginal?: boolean;
        }>;
      }
    ).__mockInferencePosts.filter((post) => post.type === "refine-foreground"),
  );
  expect(cleanupPosts.map((post) => post.componentCleanup)).toEqual([false, false]);
  expect(cleanupPosts.every((post) => post.sourceIsOriginal)).toBe(true);
});

test("accepted guided result can clean colours, enter the exact brush, and download in Russian", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Указать кистью/ }).click();
  await page.getByLabel("Загрузить изображения").setInputFiles(SAMPLE);
  const image = page.getByRole("img", {
    name: /коррекции объекта кистью/i,
  });
  await expect(image).toBeVisible();
  await image.press("Enter");
  await page.getByRole("button", { name: /Пересчитать маску/ }).click();
  await expect(page.getByTestId("guided-brush-candidates")).toBeVisible();
  await page.getByRole("button", { name: /Принять и уточнить/ }).click();

  const controls = page.getByTestId("foreground-refinement-controls");
  await controls.getByRole("button", { name: /^Очистить цвет краёв$/ }).click();
  await expect(
    controls.getByRole("button", { name: /^Очистить ещё раз$/ }),
  ).toBeVisible();
  await controls.getByRole("button", { name: /Пропустить и править кистью/ }).click();
  await expect(page.getByRole("application", { name: /редактор маски/i })).toBeVisible();
  await page.getByRole("button", { name: /^Готово$/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Скачать$/ }).click();
  expect(await download).toBeTruthy();
});

test("settled batch applies cleanup only to the selected item", async ({ page }) => {
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([SAMPLE, SAMPLE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");
  await page
    .getByRole("button", { name: /select sample\.jpg for review/i })
    .first()
    .click();
  const controls = page.getByTestId("foreground-refinement-controls");
  await controls.getByRole("button", { name: /^Clean edge colours$/ }).click();
  await expect(controls.getByRole("button", { name: /^Clean again$/ })).toBeVisible();
  const count = await page.evaluate(
    () =>
      (
        window as unknown as { __mockInferencePosts: Array<{ type: string }> }
      ).__mockInferencePosts.filter((post) => post.type === "refine-foreground").length,
  );
  expect(count).toBe(1);
});

test("cleanup reports unchanged and recoverable error outcomes without diagnostics", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__mockForegroundUnchanged", {
      configurable: true,
      value: true,
      writable: true,
    });
  });
  await uploadAutomatic(page);
  const controls = page.getByTestId("foreground-refinement-controls");
  await controls.getByRole("button", { name: /^Clean edge colours$/ }).click();
  await expect(controls.getByText(/no safe soft-edge colour changes/i)).toBeVisible();
  await expect(controls.getByText(/private no-soft-edge diagnostic/i)).toHaveCount(0);

  await page.evaluate(() => {
    (
      window as unknown as { __mockForegroundUnchanged: boolean }
    ).__mockForegroundUnchanged = false;
    Object.defineProperty(window, "__mockForegroundFailure", {
      configurable: true,
      value: true,
    });
  });
  await controls.getByRole("button", { name: /^Clean again$/ }).click();
  await expect(controls.getByRole("alert")).toContainText(/could not be completed/i);
  await expect(controls.getByRole("button", { name: /^Retry cleanup$/ })).toBeEnabled();
  await expect(controls.getByText(/private mock diagnostic/i)).toHaveCount(0);
});
