import { readFile } from "node:fs/promises";

import { expect, test } from "./support/v2/fixtures";
import { scanPhase38Accessibility } from "./support/v2/accessibility";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

type LocaleLabels = Readonly<{
  route: "/editor-v2" | "/en/editor-v2";
  choose: string;
  manual: string;
  manualRegion: string;
  manualCanvas: string;
  magic: string;
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
    route: "/en/editor-v2",
    choose: "Choose an image",
    manual: "Manual cutout",
    manualRegion: "Manual cutout workspace",
    manualCanvas: "Manual cutout canvas",
    magic: "Magic Cutout",
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
    route: "/editor-v2",
    choose: "Выбрать изображение",
    manual: "Ручная коррекция",
    manualRegion: "Ручное редактирование выреза",
    manualCanvas: "Холст ручной коррекции",
    magic: "Магическое вырезание",
    magicCanvas: "Нарисуйте подсказки «Сохранить» и «Удалить» на изображении",
    cancel: "Отменить",
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
  editorV2,
  page,
}) => {
  for (const labels of locales) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(labels.route);
    await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
    await expectAccessible(page);

    await page
      .getByLabel(labels.choose)
      .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
    await editorV2.scenario.stage("model-loading", 0.42);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    await expectAccessible(page);
    await editorV2.scenario.completeRun();
    await expect.poll(editorV2.scenario.runCount).toBe(2);
    await editorV2.scenario.stage("automatic-remove", 0.5);
    await editorV2.scenario.completeRun();
    await expect(page.getByTestId("v2-workspace-strip").locator("li")).toHaveCount(2);
    await expectAccessible(page);

    const manualLauncher = page.getByRole("button", { name: labels.manual });
    await manualLauncher.click();
    await expect(page.getByRole("region", { name: labels.manualRegion })).toBeFocused();
    await page
      .getByRole("img", { name: labels.manualCanvas })
      .click({ position: { x: 1, y: 1 } });
    await expectAccessible(page);
    await page.getByRole("button", { name: labels.cancel, exact: true }).click();
    await expect(manualLauncher).toBeFocused();

    const magicLauncher = page.getByRole("button", { name: labels.magic });
    await magicLauncher.click();
    await expect(page.getByRole("region", { name: labels.magic })).toBeFocused();
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
    await expect(magicLauncher).toBeFocused();

    await page.getByRole("button", { name: labels.background, exact: true }).click();
    await page.getByRole("button", { name: labels.ocean }).click();
    await expectAccessible(page);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: labels.enhancements, exact: true }).click();
    await page.getByRole("button", { name: labels.apply, exact: true }).click();
    await expectAccessible(page);
    await editorV2.scenario.completeEnhancement();
    await editorV2.scenario.completeEnhancement();

    await page.getByLabel(labels.addImages).setInputFiles("e2e/fixtures/unsupported.txt");
    await expectAccessible(page);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download all|Скачать все/ }).click();
    await download;
    await expectAccessible(page);

    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoPageOverflow(page);
    await expectAccessible(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await expectNoPageOverflow(page);

    const strip = page.getByTestId("v2-workspace-strip");
    while ((await strip.locator("li").count()) > 0) {
      const remove = strip
        .locator("li")
        .last()
        .getByRole("button", {
          name: /Remove |Удалить /,
        });
      await remove.click();
    }
    await expect.poll(editorV2.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
});

test("one full cutover-readiness journey keeps all documents and resources isolated", async ({
  editorV2,
  page,
}) => {
  await page.addInitScript(() => {
    const testWindow = window as Window & { __phase38LongTasks?: number[] };
    testWindow.__phase38LongTasks = [];
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      new PerformanceObserver((list) => {
        testWindow.__phase38LongTasks?.push(
          ...list.getEntries().map((entry) => entry.duration),
        );
      }).observe({ type: "longtask", buffered: true });
    }
  });
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => {
    (window as Window & { __phase38LongTasks?: number[] }).__phase38LongTasks = [];
  });
  const input = page.getByLabel("Choose an image");
  await input.setInputFiles([
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
  ]);
  const strip = page.getByTestId("v2-workspace-strip");
  await expect(strip.locator("li")).toHaveCount(3);
  for (let run = 1; run <= 3; run += 1) {
    await expect.poll(editorV2.scenario.runCount).toBe(run);
    await editorV2.scenario.stage("automatic-remove", 0.5);
    await editorV2.scenario.completeRun();
  }

  const second = strip.locator("li").nth(1);
  await second.getByRole("button", { name: /Open / }).click();
  await page.getByRole("button", { name: "Manual cutout" }).click();
  await page
    .getByRole("img", { name: "Manual cutout canvas" })
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await page.getByRole("button", { name: "Magic Cutout" }).click();
  await page
    .getByLabel("Paint Keep and Remove guidance on the image")
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Predict" }).click();
  await page.getByRole("button", { name: "Candidate 1" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await editorV2.scenario.setEnhancementOutcome("failed");
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await editorV2.scenario.completeEnhancement();
  await expect(page.getByText(/Enhancements did not finish/)).toBeVisible();
  await editorV2.scenario.setEnhancementOutcome("changed");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await editorV2.scenario.completeEnhancement();
  await editorV2.scenario.completeEnhancement();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  expect(await editorV2.scenario.runCount()).toBe(3);

  const selectedDownload = await editorV2.exportPng.download();
  expect(selectedDownload.suggestedFilename()).toMatch(/-no-background\.png$/);
  const allDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
  const archive = await allDownload;
  expect(archive.suggestedFilename()).toBe("cutbg-results.zip");
  const archivePath = await archive.path();
  if (archivePath === null) throw new Error("Downloaded ZIP path is unavailable");
  const archiveText = (await readFile(archivePath)).toString("utf8");
  expect(archiveText).toContain("cutbg-result-01.png");
  expect(archiveText).not.toContain("sample");

  await page.getByLabel("Add images").setInputFiles("e2e/fixtures/unsupported.txt");
  await strip.getByRole("button", { name: /Remove unsupported\.txt/ }).click();

  while ((await strip.locator("li").count()) > 0)
    await strip
      .locator("li")
      .last()
      .getByRole("button", { name: /Remove / })
      .click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.getByLabel("Choose an image").setInputFiles(phase33ImageCorpus.smoke.path);
    await editorV2.scenario.completeRun();
    await page.getByRole("button", { name: "Start over" }).click();
    await expect.poll(editorV2.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
  const longestApplicationTask = await page.evaluate(() =>
    Math.max(
      0,
      ...((window as Window & { __phase38LongTasks?: number[] }).__phase38LongTasks ??
        []),
    ),
  );
  expect(longestApplicationTask).toBeLessThan(50);
});
