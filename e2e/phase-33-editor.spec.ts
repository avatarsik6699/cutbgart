import { expect, test } from "./support/editor/fixtures";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("editor runs once, remains interactive, cancels/retries, exports, and resets", async ({
  editor,
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.stage("model-loading", 0.5);
  await expect(editor.progress.currentStage).toContainText(/Loading .*model/);
  const modelScrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.move(450, 250);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(modelScrollBefore);

  await editor.scenario.stage("automatic-remove", 0.5);
  await expect(editor.progress.currentStage).toContainText("Removing background");
  await page.mouse.wheel(0, 300);

  await editor.scenario.completeRun();
  await expect(editor.exportPng.button).toBeVisible();
  await expect(editor.preview.image).toBeVisible();

  expect((await editor.exportPng.download()).suggestedFilename()).toBe(
    "cutbg-result.png",
  );
  await expect.poll(editor.scenario.runCount).toBe(1);

  await editor.preview.resetButton.click();
  await expect(editor.upload.input).toBeVisible();
  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect(editor.progress.cancelButton).toBeVisible();
  await editor.progress.cancelButton.click();
  await expect(editor.progress.retryButton).toBeVisible();
  await editor.progress.retryButton.click();
  await expect.poll(editor.scenario.runCount).toBe(3);
  await editor.scenario.stage("automatic-remove", 0.5);
  await expect(editor.progress.currentStage).toContainText("Removing background");
  await editor.scenario.completeRun();
  await expect(editor.exportPng.button).toBeVisible();
  await editor.preview.resetButton.click();
  await expect.poll(editor.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });

  for (let iteration = 0; iteration < 10; iteration += 1) {
    await editor.upload.choose(phase33ImageCorpus.smoke.path);
    await expect(editor.progress.cancelButton).toBeVisible();
    await editor.progress.cancelButton.click();
    await expect(editor.progress.retryButton).toBeVisible();
    await editor.preview.resetButton.click();
    await expect.poll(editor.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
});

test("public editor exposes the Russian surface", async ({ editor, page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

  await expect(
    page.getByRole("heading", { name: "Удалите фон с фото за секунды" }),
  ).toBeVisible();
  await expect(page.getByLabel("Загрузить изображения")).toBeVisible();
  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.stage("model-loading", 1);
  await expect(editor.progress.currentStage).toContainText(/Загружаем модель/);
  await editor.scenario.stage("automatic-remove", 0.5);
  await expect(editor.progress.currentStage).toContainText("Удаляем фон");
  await editor.scenario.completeRun();
  await expect(editor.exportPng.button).toBeVisible();
  await editor.preview.resetButton.click();
  await expect.poll(editor.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});
