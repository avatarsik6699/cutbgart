import { readFile } from "node:fs/promises";

import { expect, test } from "./support/v2/fixtures";
import { phase33ImageCorpus } from "./support/v2/image-corpus";
import { installMockInference } from "./support/mock-inference";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

const locales = [
  {
    route: "/en/editor-v2",
    upload: "Upload an image",
    select: /Select /,
    remove: "Remove image",
  },
  {
    route: "/editor-v2",
    upload: "Загрузить изображения",
    select: /Выбрать /,
    remove: "Удалить изображение",
  },
] as const;

const viewports = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "narrow", width: 390, height: 844 },
] as const;

for (const locale of locales) {
  for (const viewport of viewports) {
    test(`v1 ${locale.route} ${viewport.id} batch processing reference`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.install({ time: new Date("2026-08-04T11:00:00Z") });
      await installMockInference(page, { manualAutomaticStages: true });
      await page.goto(locale.route === "/en/editor-v2" ? "/en" : "/");
      await expect(
        page.locator('[data-slot="site-header"][data-hydrated="true"]'),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.clock.pauseAt(new Date("2026-08-04T12:00:05Z"));
      const input =
        viewport.id === "desktop"
          ? page.getByLabel(locale.upload)
          : page.locator('input[type="file"][capture="environment"]');
      await input.setInputFiles([
        phase33ImageCorpus.smoke.path,
        phase33ImageCorpus.smoke.path,
      ]);
      await expect(page.getByTestId("batch-overview").locator("article")).toHaveCount(2);
      await expect(page.getByRole("progressbar")).toBeVisible();
      await expect(page).toHaveScreenshot(
        `v1-${locale.route.includes("/en/") ? "en" : "ru"}-${viewport.id}-batch-processing.png`,
        { animations: "disabled", caret: "hide", fullPage: true, scale: "css" },
      );
    });

    test(`v1 ${locale.route} ${viewport.id} batch reference`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await installMockInference(page);
      await page.goto(locale.route === "/en/editor-v2" ? "/en" : "/");
      await expect(
        page.locator('[data-slot="site-header"][data-hydrated="true"]'),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const input =
        viewport.id === "desktop"
          ? page.getByLabel(locale.upload)
          : page.locator('input[type="file"][capture="environment"]');
      await input.setInputFiles([
        phase33ImageCorpus.smoke.path,
        phase33ImageCorpus.smoke.path,
      ]);
      const rail = page.getByTestId("batch-overview");
      await expect(rail.locator("article")).toHaveCount(2);
      await expect(
        rail.locator("article").nth(0).getByRole("button", { name: locale.select }),
      ).toBeEnabled();
      await expect(
        rail.locator("article").nth(1).getByRole("button", { name: locale.select }),
      ).toBeEnabled();
      await rail
        .locator("article")
        .nth(1)
        .getByRole("button", { name: locale.select })
        .click();
      await expect(page).toHaveScreenshot(
        `v1-${locale.route.includes("/en/") ? "en" : "ru"}-${viewport.id}-batch-selected.png`,
        { animations: "disabled", caret: "hide", fullPage: true, scale: "css" },
      );
    });
  }
}

for (const locale of locales) {
  for (const viewport of viewports) {
    test(`${locale.route} ${viewport.id} preserves the v1 batch rail and selection`, async ({
      editorV2,
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(locale.route);
      await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
      const input =
        viewport.id === "desktop"
          ? page.getByLabel(locale.upload)
          : page.locator('input[type="file"][capture="environment"]');
      await input.setInputFiles([
        phase33ImageCorpus.smoke.path,
        phase33ImageCorpus.smoke.path,
      ]);
      const rail = page.getByTestId("batch-overview");
      await expect(rail.locator("article")).toHaveCount(2);
      await editorV2.scenario.stage("automatic-remove", 0.5);
      await expect(page).toHaveScreenshot(
        `${locale.route.includes("/en/") ? "en" : "ru"}-${viewport.id}-batch-processing.png`,
        { animations: "disabled", caret: "hide", fullPage: true, scale: "css" },
      );
      await editorV2.scenario.completeRun();
      await expect.poll(editorV2.scenario.runCount).toBe(2);
      await editorV2.scenario.stage("automatic-remove", 0.5);
      await editorV2.scenario.completeRun();
      const second = rail.locator("article").nth(1).getByRole("button", {
        name: locale.select,
      });
      await second.click();
      await expect(second).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveScreenshot(
        `${locale.route.includes("/en/") ? "en" : "ru"}-${viewport.id}-batch-selected.png`,
        { animations: "disabled", caret: "hide", fullPage: true, scale: "css" },
      );
    });
  }
}

test("mixed failure, item actions, ZIP, and cleanup stay isolated", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await page
    .getByLabel("Upload an image")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
  const rail = page.getByTestId("batch-overview");
  for (let run = 1; run <= 2; run += 1) {
    await expect.poll(editorV2.scenario.runCount).toBe(run);
    await editorV2.scenario.completeRun();
  }
  await page.getByLabel("Add images").setInputFiles("e2e/fixtures/unsupported.txt");
  await expect(rail.getByText("Failed", { exact: true })).toBeVisible();

  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download all/ }).click();
  const zip = await zipPromise;
  expect(zip.suggestedFilename()).toBe("cutbg-results.zip");
  const zipPath = await zip.path();
  if (zipPath === null) throw new Error("Downloaded ZIP path is unavailable");
  const archive = (await readFile(zipPath)).toString("utf8");
  expect(archive).toContain("cutbg-result-01.png");
  expect(archive).toContain("cutbg-result-02.png");
  expect(archive).not.toContain("sample");

  while ((await rail.locator("article").count()) > 0) {
    await rail.locator("article").last().getByTestId("batch-item-actions").click();
    await page.getByRole("menuitem", { name: "Remove image" }).click();
  }
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});
