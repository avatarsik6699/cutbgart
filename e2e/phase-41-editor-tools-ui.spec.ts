import type { Page } from "@playwright/test";

import { expect, test } from "./support/v2/fixtures";

import { installMockInference } from "./support/mock-inference";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

const locales = [
  {
    id: "en",
    publicRoute: "/en",
    v2Route: "/en/editor-v2",
    upload: "Upload an image",
    background: "Background",
    enhancements: "Enhancements",
    manual: "Manual",
    select: /Select /,
  },
  {
    id: "ru",
    publicRoute: "/",
    v2Route: "/editor-v2",
    upload: "Загрузить изображения",
    background: "Фон",
    enhancements: "Улучшения",
    manual: "Вручную",
    select: /Выбрать /,
  },
] as const;

const viewports = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "narrow", width: 390, height: 844 },
] as const;

function uploadInput(page: Page, label: string, viewport: "desktop" | "narrow") {
  return viewport === "desktop"
    ? page.getByLabel(label)
    : page.locator('input[type="file"][capture="environment"]');
}

async function expectScreenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    scale: "css",
  });
}

for (const locale of locales) {
  for (const viewport of viewports) {
    test(`v1 ${locale.id} ${viewport.id} editor tools reference`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await installMockInference(page);
      await page.goto(locale.publicRoute);
      await expect(
        page.locator('[data-slot="site-header"][data-hydrated="true"]'),
      ).toBeVisible();
      const input = uploadInput(page, locale.upload, viewport.id);
      await input.setInputFiles(phase33ImageCorpus.smoke.path);
      await expect(page.locator('[data-tool-id="cutout"]')).toBeVisible();
      await expectScreenshot(page, `v1-${locale.id}-${viewport.id}-cutout.png`);
      await page.getByRole("tab", { name: locale.manual, exact: true }).click();
      await expectScreenshot(page, `v1-${locale.id}-${viewport.id}-manual.png`);
      await page.getByRole("button", { name: locale.enhancements, exact: true }).click();
      await expectScreenshot(page, `v1-${locale.id}-${viewport.id}-enhancements.png`);
      await page.getByRole("button", { name: locale.background, exact: true }).click();
      await expectScreenshot(page, `v1-${locale.id}-${viewport.id}-background.png`);
    });

    test(`v2 ${locale.id} ${viewport.id} editor tools use v1 chrome`, async ({
      editorV2,
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(locale.v2Route);
      await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
      const input = uploadInput(page, locale.upload, viewport.id);
      await input.setInputFiles(phase33ImageCorpus.smoke.path);
      await expect.poll(editorV2.scenario.runCount).toBe(1);
      await editorV2.scenario.completeRun();
      await expect(page.getByTestId("editor-tool-workspace")).toBeVisible();
      await expect(page.getByRole("tab", { name: /Magic|Магия/ })).toBeVisible();
      await expectScreenshot(page, `v2-${locale.id}-${viewport.id}-cutout.png`);
      await page.getByRole("tab", { name: locale.manual, exact: true }).click();
      await expect(page.getByRole("region", { name: /Manual|Ручн/ })).toBeFocused();
      await expectScreenshot(page, `v2-${locale.id}-${viewport.id}-manual.png`);
      await page.getByRole("button", { name: locale.enhancements, exact: true }).click();
      await expect(page.getByTestId("enhancements-tool-panel")).toBeVisible();
      await expectScreenshot(page, `v2-${locale.id}-${viewport.id}-enhancements.png`);
      await page.getByRole("button", { name: locale.background, exact: true }).click();
      await expect(page.getByRole("region", { name: locale.background })).toBeFocused();
      await expectScreenshot(page, `v2-${locale.id}-${viewport.id}-background.png`);
    });
  }
}

test("dirty tool draft survives batch selection and guarded tool navigation", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await page
    .getByLabel("Upload an image")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
  for (let run = 1; run <= 2; run += 1) {
    await expect.poll(editorV2.scenario.runCount).toBe(run);
    await editorV2.scenario.completeRun();
  }

  const rail = page.getByTestId("batch-overview");
  const first = rail
    .locator("article")
    .nth(0)
    .getByRole("button", { name: /Select / });
  const second = rail
    .locator("article")
    .nth(1)
    .getByRole("button", { name: /Select / });
  await first.click();
  const canvas = page.getByLabel("Paint Keep and Remove guidance on the image");
  await canvas.click({ position: { x: 8, y: 8 } });
  await expect(page.getByText("1/50 strokes")).toBeVisible();

  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await first.click();
  await expect(page.getByText("1/50 strokes")).toBeVisible();
  expect(await editorV2.scenario.runCount()).toBe(2);

  await page.getByRole("button", { name: "Background", exact: true }).click();
  const guard = page.getByRole("alertdialog");
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Continue editing" }).click();
  await expect(page.getByRole("tab", { name: "Magic" })).toBeVisible();
  await page.getByRole("button", { name: "Background", exact: true }).click();
  await guard.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByRole("region", { name: "Background" })).toBeFocused();

  await page.getByRole("button", { name: "Back to upload" }).click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});
