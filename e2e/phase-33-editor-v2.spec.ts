import { expect, test } from "./support/v2/fixtures";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("editor v2 runs once, remains interactive, cancels/retries, exports, and resets", async ({
  editorV2,
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
  await editorV2.scenario.stage("model-loading", 0.5);
  await expect(editorV2.progress.currentStage).toContainText(/Loading .*model/);
  const modelScrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.move(450, 250);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(modelScrollBefore);

  await editorV2.scenario.stage("automatic-remove", 0.5);
  await expect(editorV2.progress.currentStage).toContainText("Removing background");
  await page.mouse.wheel(0, 300);

  await editorV2.scenario.completeRun();
  await expect(editorV2.exportPng.button).toBeVisible();
  await expect(editorV2.preview.image).toBeVisible();

  expect((await editorV2.exportPng.download()).suggestedFilename()).toBe(
    "cutbg-result.png",
  );
  await expect.poll(editorV2.scenario.runCount).toBe(1);

  await editorV2.preview.resetButton.click();
  await expect(editorV2.upload.input).toBeVisible();
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await expect(editorV2.progress.cancelButton).toBeVisible();
  await editorV2.progress.cancelButton.click();
  await expect(editorV2.progress.retryButton).toBeVisible();
  await editorV2.progress.retryButton.click();
  await expect.poll(editorV2.scenario.runCount).toBe(3);
  await editorV2.scenario.stage("automatic-remove", 0.5);
  await expect(editorV2.progress.currentStage).toContainText("Removing background");
  await editorV2.scenario.completeRun();
  await expect(editorV2.exportPng.button).toBeVisible();
  await editorV2.preview.resetButton.click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });

  for (let iteration = 0; iteration < 10; iteration += 1) {
    await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
    await expect(editorV2.progress.cancelButton).toBeVisible();
    await editorV2.progress.cancelButton.click();
    await expect(editorV2.progress.retryButton).toBeVisible();
    await editorV2.preview.resetButton.click();
    await expect.poll(editorV2.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
});

test("editor v2 exposes the Russian noindex surface", async ({ editorV2, page }) => {
  await page.goto("/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

  await expect(
    page.getByRole("heading", { name: "Удалите фон с фото за секунды" }),
  ).toBeVisible();
  await expect(page.getByLabel("Загрузить изображения")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
  await editorV2.scenario.stage("model-loading", 1);
  await expect(editorV2.progress.currentStage).toContainText(/Загружаем модель/);
  await editorV2.scenario.stage("automatic-remove", 0.5);
  await expect(editorV2.progress.currentStage).toContainText("Удаляем фон");
  await editorV2.scenario.completeRun();
  await expect(editorV2.exportPng.button).toBeVisible();
  await editorV2.preview.resetButton.click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});
