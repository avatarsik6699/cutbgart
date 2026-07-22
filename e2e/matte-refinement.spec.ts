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

async function automaticResult(page: import("@playwright/test").Page, locale = "/en") {
  await page.goto(locale);
  await expect(
    page.getByLabel(locale === "/en" ? "Upload an image" : "Загрузить изображения"),
  ).toBeEnabled();
  await page
    .getByLabel(locale === "/en" ? "Upload an image" : "Загрузить изображения")
    .setInputFiles(SAMPLE);
  await expect(
    page.getByRole("slider", { name: /before\/after|до и после/i }),
  ).toBeVisible();
}

test("balanced refinement is lazy, disposes automatic inference, and continues to brush/download", async ({
  page,
}) => {
  await automaticResult(page);
  const controls = page.getByTestId("matte-refinement-controls");
  await expect(controls.getByText(/27\.5 MB/)).toBeVisible();
  await expect(controls.getByText(/104 MB/)).toBeVisible();
  await controls.getByRole("button", { name: /^Refine edges$/ }).click();
  await expect(controls.getByRole("button", { name: /Refine again/ })).toBeVisible();

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
  expect(posts.find((post) => post.type === "refine")?.requestedMode).toBe("balanced");

  await controls.getByRole("button", { name: /Skip and edit with brush/ }).click();
  await expect(
    page.getByRole("application", { name: /mask correction editor/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Done$/ }).click();
  await expect(page.getByRole("button", { name: /^Download$/ })).toBeVisible();
});

test("maximum falls back once to balanced and preserves the result", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "__mockMattingMaximumFailure", {
      configurable: true,
      value: true,
    }),
  );
  await automaticResult(page);
  const controls = page.getByTestId("matte-refinement-controls");
  await controls.getByRole("radio", { name: /Maximum/ }).click();
  await controls.getByRole("button", { name: /^Refine edges$/ }).click();
  await expect(controls.getByText(/Continuing once with Balanced/)).toBeVisible();
  await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible();
});

test("balanced failure uses the localized deterministic fallback", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "__mockMattingBalancedFailure", {
      configurable: true,
      value: true,
    }),
  );
  await automaticResult(page, "/");
  const controls = page.getByTestId("matte-refinement-controls");
  await controls.getByRole("button", { name: /^Уточнить края$/ }).click();
  await expect(controls.getByText(/Текущая маска.*сохранены/)).toBeVisible();
  await expect(page.getByRole("slider", { name: /до и после/i })).toBeVisible();
});

test("an accepted guided result can enter refinement before the exact brush", async ({
  page,
}) => {
  await page.goto("/en");
  await page.getByRole("button", { name: /Point or box/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  const image = page.getByRole("img", { name: /guided object selection/i });
  await expect(image).toBeVisible();
  await image.click();
  await page.getByRole("button", { name: /Accept and refine/ }).click();
  const controls = page.getByTestId("matte-refinement-controls");
  await expect(controls).toBeVisible();
  await controls.getByRole("button", { name: /^Refine edges$/ }).click();
  await expect(controls.getByRole("button", { name: /Refine again/ })).toBeVisible();
});

test("a settled batch refines only the selected completed item", async ({ page }) => {
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([SAMPLE, SAMPLE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");
  await page
    .getByRole("button", { name: /select sample\.jpg for review/i })
    .first()
    .click();
  const controls = page.getByTestId("matte-refinement-controls");
  await expect(controls.getByRole("button", { name: /^Refine edges$/ })).toBeEnabled();
  await controls.getByRole("button", { name: /^Refine edges$/ }).click();
  await expect(controls.getByRole("button", { name: /Refine again/ })).toBeVisible();
  const refineCount = await page.evaluate(
    () =>
      (
        window as unknown as { __mockInferencePosts: Array<{ type: string }> }
      ).__mockInferencePosts.filter((post) => post.type === "refine").length,
  );
  expect(refineCount).toBe(1);
});
