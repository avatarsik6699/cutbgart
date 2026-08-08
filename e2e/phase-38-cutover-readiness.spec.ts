import { readFile } from "node:fs/promises";

import { expect, test } from "./support/editor/fixtures";
import { scanPhase38Accessibility } from "./support/editor/accessibility";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

type LocaleLabels = Readonly<{
  route: "/" | "/en/";
  choose: string;
  manual: string;
  manualRegion: string;
  manualCanvas: string;
  magic: string;
  magicRegion: string;
  magicCanvas: string;
  cancel: string;
  continueEditing: string;
  discard: string;
  background: string;
  ocean: string;
  enhancements: string;
  apply: string;
  addImages: string;
}>;

const locales: readonly LocaleLabels[] = [
  {
    route: "/en/",
    choose: "Upload an image",
    manual: "Manual",
    manualRegion: "Manual cutout workspace",
    manualCanvas: "Manual cutout canvas",
    magic: "Magic",
    magicRegion: "Magic Cutout",
    magicCanvas: "Paint Keep and Remove guidance on the image",
    cancel: "Cancel",
    continueEditing: "Continue editing",
    discard: "Discard draft",
    background: "Background",
    ocean: "Ocean",
    enhancements: "Enhancements",
    apply: "Apply",
    addImages: "Add images",
  },
  {
    route: "/",
    choose: "Загрузить изображения",
    manual: "Вручную",
    manualRegion: "Ручное редактирование выреза",
    manualCanvas: "Холст ручной коррекции",
    magic: "Магия",
    magicRegion: "Магическое вырезание",
    magicCanvas: "Нарисуйте подсказки «Сохранить» и «Удалить» на изображении",
    cancel: "Отмена",
    continueEditing: "Продолжить редактирование",
    discard: "Отбросить черновик",
    background: "Фон",
    ocean: "Океан",
    enhancements: "Улучшения",
    apply: "Применить",
    addImages: "Добавить изображения",
  },
];

async function expectAccessible(page: Parameters<typeof scanPhase38Accessibility>[0]) {
  expect(await scanPhase38Accessibility(page)).toEqual([]);
}

async function expectNoPageOverflow(
  page: Parameters<typeof scanPhase38Accessibility>[0],
): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: globalThis.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

test("both locales pass the accessibility and responsive material-state matrix", async ({
  editor,
  page,
}) => {
  test.setTimeout(90_000);
  for (const labels of locales) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(labels.route);
    await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
    await expectAccessible(page);

    await page
      .getByLabel(labels.choose)
      .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
    await expect.poll(editor.scenario.runCount).toBe(1);
    await editor.scenario.stage("model-loading", 0.42);
    await expect(page.locator('[data-main-page-phase="loading-model"]')).toContainText(
      "42",
    );
    await expectAccessible(page);
    await editor.scenario.completeRun();
    await expect.poll(editor.scenario.runCount).toBe(2);
    await editor.scenario.stage("automatic-remove", 0.5);
    await editor.scenario.completeRun();
    await expect(page.getByTestId("batch-overview").locator("article")).toHaveCount(2);
    await expectAccessible(page);

    const manualLauncher = page.getByRole("tab", { name: labels.manual });
    await manualLauncher.click();
    await expect(page.getByRole("region", { name: labels.manualRegion })).toBeFocused();
    await page
      .getByRole("img", { name: labels.manualCanvas })
      .click({ position: { x: 1, y: 1 } });
    await expectAccessible(page);
    await page.getByRole("button", { name: labels.cancel, exact: true }).click();
    await expect(page.getByRole("region", { name: labels.manualRegion })).toBeFocused();

    const magicLauncher = page.getByRole("tab", { name: labels.magic });
    await magicLauncher.click();
    await expect(page.getByRole("region", { name: labels.magicRegion })).toBeFocused();
    await page.getByLabel(labels.magicCanvas).click({ position: { x: 1, y: 1 } });
    await page.getByRole("button", { name: labels.cancel, exact: true }).click();
    const discardDialog = page.getByRole("alertdialog");
    await expect(discardDialog).toBeVisible();
    await expect(
      page.getByRole("button", { name: labels.continueEditing }),
    ).toBeFocused();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(discardDialog).toBeHidden();
    await page.getByRole("button", { name: labels.cancel, exact: true }).click();
    await page.getByRole("button", { name: labels.discard }).click();
    await expect(page.getByRole("region", { name: labels.magicRegion })).toBeFocused();

    await page.getByRole("button", { name: labels.background, exact: true }).click();
    await page.getByRole("button", { name: labels.ocean }).click();
    await expectAccessible(page);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: labels.enhancements, exact: true }).click();
    await page.getByRole("button", { name: labels.apply, exact: true }).click();
    await expectAccessible(page);
    await editor.scenario.completeEnhancement();
    await editor.scenario.completeEnhancement();

    await page.getByLabel(labels.addImages).setInputFiles("e2e/fixtures/unsupported.txt");
    await expectAccessible(page);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: /Output options|Параметры результата/ })
      .click();
    await page.getByRole("menuitem", { name: /Download all|Скачать вс[её]/ }).click();
    await download;
    await expectAccessible(page);

    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await expectNoPageOverflow(page);

    const strip = page.getByTestId("batch-overview");
    while ((await strip.locator("article").count()) > 0) {
      await strip.locator("article").last().getByTestId("batch-item-actions").click();
      await page
        .getByRole("menuitem", { name: /Remove image|Удалить изображение/ })
        .click();
    }
    await expect.poll(editor.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
});

test("one full cutover-readiness journey keeps all documents and resources isolated", async ({
  editor,
  page,
}) => {
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  const input = page.getByLabel("Upload an image");
  await input.setInputFiles([
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
  ]);
  const strip = page.getByTestId("batch-overview");
  await expect(strip.locator("article")).toHaveCount(3);
  for (let run = 1; run <= 3; run += 1) {
    await expect.poll(editor.scenario.runCount).toBe(run);
    await editor.scenario.stage("automatic-remove", 0.5);
    await editor.scenario.completeRun();
  }

  const second = strip.locator("article").nth(1);
  await second.getByRole("button", { name: /Select / }).click();
  await page.getByRole("tab", { name: "Manual" }).click();
  await page
    .getByRole("img", { name: "Manual cutout canvas" })
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await page.getByRole("tab", { name: "Magic" }).click();
  await page
    .getByLabel("Paint Keep and Remove guidance on the image")
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await editor.scenario.setEnhancementOutcome("failed");
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await editor.scenario.completeEnhancement();
  await expect(page.getByText(/Enhancements could not be completed/)).toBeVisible();
  await editor.scenario.setEnhancementOutcome("changed");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await editor.scenario.completeEnhancement();
  await editor.scenario.completeEnhancement();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  expect(await editor.scenario.runCount()).toBe(3);

  const selectedDownload = await editor.exportPng.download();
  expect(selectedDownload.suggestedFilename()).toBe("cutbg-result.png");
  const allDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Output options" }).click();
  await page.getByRole("menuitem", { name: /Download all/ }).click();
  const archive = await allDownload;
  expect(archive.suggestedFilename()).toBe("cutbg-results.zip");
  const archivePath = await archive.path();
  if (archivePath === null) throw new Error("Downloaded ZIP path is unavailable");
  const archiveText = (await readFile(archivePath)).toString("utf8");
  expect(archiveText).toContain("cutbg-result-01.png");
  expect(archiveText).not.toContain("sample");

  await page.getByLabel("Add images").setInputFiles("e2e/fixtures/unsupported.txt");
  await strip.locator("article").last().getByTestId("batch-item-actions").click();
  await page.getByRole("menuitem", { name: "Remove image" }).click();

  while ((await strip.locator("article").count()) > 0) {
    await strip.locator("article").last().getByTestId("batch-item-actions").click();
    await page.getByRole("menuitem", { name: "Remove image" }).click();
  }
  await expect.poll(editor.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const expectedRunCount = (await editor.scenario.runCount()) + 1;
    await page.getByLabel("Upload an image").setInputFiles(phase33ImageCorpus.smoke.path);
    await expect.poll(editor.scenario.runCount).toBe(expectedRunCount);
    await editor.scenario.completeRun();
    await page.getByRole("button", { name: "Back to upload" }).click();
    await expect.poll(editor.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
});
