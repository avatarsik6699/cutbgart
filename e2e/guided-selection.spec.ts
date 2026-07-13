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

async function enterGuided(page: import("@playwright/test").Page) {
  await page.goto("/en");
  await expect(page.getByRole("radio")).toHaveCount(3);
  const guided = page.getByRole("button", { name: /Point or box/ });
  await expect(guided).toBeEnabled();
  await guided.click();
  await expect(page.getByText(/SlimSAM q8/)).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  await expect(page.getByTestId("guided-selection")).toBeVisible();
  await expect(page.getByText(/Choose a point or draw a box/)).toBeVisible();
  await expect(page.getByTestId("processing-mode-selector")).toHaveCount(0);
}

test("point prompt continues through brush correction and download", async ({ page }) => {
  await enterGuided(page);
  const image = page.getByRole("img", { name: /guided object selection/ });
  await image.click();
  await expect(page.getByTestId("guided-point-marker")).toBeVisible();
  await expect(page.getByTestId("guided-mask-overlay")).toBeVisible();
  await expect(page.getByRole("button", { name: /Accept and refine/ })).toBeVisible();
  await page.getByRole("button", { name: /Accept and refine/ }).click();
  await expect(
    page.getByRole("application", { name: /mask correction editor/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Done$/ }).click();
  await expect(page.getByRole("button", { name: /^Download$/ })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await pending).suggestedFilename()).toBe("result.png");
});

test("box prompt maps a responsive drag and can be replaced", async ({ page }) => {
  await enterGuided(page);
  await page.getByRole("button", { name: /^Box$/ }).click();
  const image = page.getByRole("img", { name: /guided object selection/ });
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Guided image has no bounds");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
  await expect(page.getByTestId("guided-box-draft")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByText(/Mask ready/i)).toBeVisible();
  await expect(page.getByTestId("guided-box-marker")).toBeVisible();
  await expect(page.getByTestId("guided-mask-overlay")).toBeVisible();
  const prompts = await page.evaluate(
    () =>
      (window as unknown as { __mockInferencePosts: Array<{ promptType?: string }> })
        .__mockInferencePosts,
  );
  expect(prompts.some((post) => post.promptType === "box")).toBe(true);
  await page.getByRole("button", { name: /Replace prompt/ }).click();
  await expect(page.getByTestId("guided-box-marker")).toHaveCount(0);
  await expect(page.getByTestId("guided-mask-overlay")).toHaveCount(0);
  await expect(page.getByText(/Choose a point or draw a box/)).toBeVisible();
  await page.getByRole("button", { name: /Cancel guided selection/ }).click();
  await expect(page.getByLabel("Upload an image")).toBeAttached();
});

test("localizes the guided method and recovers from a worker crash", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__mockGuidedWorkerCrash", {
      configurable: true,
      writable: true,
      value: true,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Указать точкой или рамкой/ }).click();
  await expect(page.getByText(/SlimSAM q8/)).toBeVisible();
  await page.getByLabel("Загрузить изображения").setInputFiles(SAMPLE);
  await expect(page.getByRole("alert")).toContainText(/Не удалось выбрать объект/);
  await expect(page.getByText(/Guided worker failed to load/)).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __mockGuidedWorkerCrash: boolean }).__mockGuidedWorkerCrash =
      false;
  });
  await page.getByRole("button", { name: /Повторить/ }).click();
  await expect(page.getByText(/Укажите точку или нарисуйте рамку/)).toBeVisible();
});
