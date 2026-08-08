import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";

import { expect, test } from "./support/editor/fixtures";
import { scanPhase42Accessibility } from "./support/editor/accessibility";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

type LocaleContract = Readonly<{
  route: "/" | "/en/";
  backToUpload: string;
  upload: string;
  addImages: string;
  manual: string;
  manualCanvas: string;
  magic: string;
  magicCanvas: string;
  background: string;
  ocean: string;
  enhancements: string;
  apply: string;
  download: string;
  downloadAll: RegExp;
  downloadOptions: string;
  remove: RegExp;
}>;

const locales: readonly LocaleContract[] = [
  {
    route: "/en/",
    backToUpload: "Back to upload",
    upload: "Upload an image",
    addImages: "Add images",
    manual: "Manual",
    manualCanvas: "Manual cutout canvas",
    magic: "Magic",
    magicCanvas: "Paint Keep and Remove guidance on the image",
    background: "Background",
    ocean: "Ocean",
    enhancements: "Enhancements",
    apply: "Apply",
    download: "Download",
    downloadAll: /Download all/,
    downloadOptions: "Output options",
    remove: /Remove image/,
  },
  {
    route: "/",
    backToUpload: "К загрузке",
    upload: "Загрузить изображения",
    addImages: "Добавить изображения",
    manual: "Вручную",
    manualCanvas: "Холст ручной коррекции",
    magic: "Магия",
    magicCanvas: "Нарисуйте подсказки «Сохранить» и «Удалить» на изображении",
    background: "Фон",
    ocean: "Океан",
    enhancements: "Улучшения",
    apply: "Применить",
    download: "Скачать",
    downloadAll: /Скачать вс[её]/,
    downloadOptions: "Параметры результата",
    remove: /Удалить изображение/,
  },
];

async function dispatchAdmission(
  page: Page,
  inputLabel: string,
  method: "drop" | "paste",
  bytes: readonly number[],
): Promise<void> {
  await page.getByLabel(inputLabel).evaluate(
    (input, payload) => {
      const file = new File([new Uint8Array(payload.bytes)], "phase-42-input.jpg", {
        type: "image/jpeg",
      });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      if (payload.method === "drop") {
        input.parentElement?.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
        return;
      }
      window.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
        }),
      );
    },
    { bytes, method },
  );
}

async function expectAccessible(page: Page): Promise<void> {
  expect(await scanPhase42Accessibility(page)).toEqual([]);
}

async function expectNoHorizontalPageOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: globalThis.innerWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
}

test("both locales complete the single, batch, tool, recovery and export matrix", async ({
  editor,
  page,
}) => {
  const fixtureBytes = [...(await readFile(phase33ImageCorpus.smoke.path))];

  for (const labels of locales) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(labels.route);
    await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
    await expectAccessible(page);

    await dispatchAdmission(page, labels.upload, "drop", fixtureBytes);
    await expect.poll(editor.scenario.runCount).toBe(1);
    await editor.scenario.stage("model-loading", 0.42);
    await editor.scenario.completeRun();
    await page.getByRole("button", { name: labels.backToUpload, exact: true }).click();
    await expect(page.getByLabel(labels.upload)).toBeVisible();

    await dispatchAdmission(page, labels.upload, "paste", fixtureBytes);
    await expect.poll(editor.scenario.runCount).toBe(2);
    await editor.scenario.completeRun();
    await page.getByRole("button", { name: labels.backToUpload, exact: true }).click();
    await expect(page.getByLabel(labels.upload)).toBeVisible();

    await page
      .getByLabel(labels.upload)
      .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
    await expect.poll(editor.scenario.runCount).toBe(3);
    await editor.scenario.completeRun();
    await expect.poll(editor.scenario.runCount).toBe(4);
    await editor.scenario.completeRun();

    const batch = page.getByTestId("batch-overview");
    await expect(batch.locator("article")).toHaveCount(2);
    await batch
      .locator("article")
      .nth(1)
      .getByRole("button", { name: /Select |Выбрать / })
      .click();

    await page.getByRole("tab", { name: labels.manual, exact: true }).click();
    await page
      .getByRole("img", { name: labels.manualCanvas })
      .click({ position: { x: 8, y: 8 } });
    await page.getByRole("button", { name: labels.apply, exact: true }).click();
    await expect.poll(editor.scenario.manualCommitCount).toBe(1);

    await page.getByRole("tab", { name: labels.magic, exact: true }).click();
    await page.getByLabel(labels.magicCanvas).click({ position: { x: 8, y: 8 } });
    await page.getByRole("button", { name: labels.apply, exact: true }).click();
    await expect.poll(editor.scenario.magicPredictionCount).toBe(1);
    await expect.poll(editor.scenario.magicCommitCount).toBe(1);

    await page.getByRole("button", { name: labels.background, exact: true }).click();
    await page.getByRole("button", { name: labels.ocean }).click();
    await page.getByRole("button", { name: labels.apply, exact: true }).click();
    await expect.poll(editor.scenario.backgroundCommitCount).toBe(1);
    await expect(
      page.getByRole("button", { name: labels.background, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: labels.enhancements, exact: true }).click();
    await page.getByRole("button", { name: labels.apply, exact: true }).click();
    await editor.scenario.completeEnhancement();
    await editor.scenario.completeEnhancement();
    await expect.poll(editor.scenario.enhancementCommitCount).toBe(1);
    await expect(
      page.getByRole("button", { name: labels.enhancements, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+y");
    expect(await editor.scenario.runCount()).toBe(4);
    await expectAccessible(page);

    const selectedDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: labels.download, exact: true }).click();
    expect((await selectedDownload).suggestedFilename()).toBe("cutbg-result.png");
    const zipDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: labels.downloadOptions }).click();
    await page.getByRole("menuitem", { name: labels.downloadAll }).click();
    expect((await zipDownload).suggestedFilename()).toBe("cutbg-results.zip");

    await page.getByLabel(labels.addImages).setInputFiles("e2e/fixtures/unsupported.txt");
    await expectAccessible(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalPageOverflow(page);
    await expectAccessible(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await expectNoHorizontalPageOverflow(page);

    while ((await batch.locator("article").count()) > 0) {
      await batch.locator("article").last().getByTestId("batch-item-actions").click();
      await page.getByRole("menuitem", { name: labels.remove }).click();
    }
    await expect.poll(editor.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const nextRun = (await editor.scenario.runCount()) + 1;
      await page.getByLabel(labels.upload).setInputFiles(phase33ImageCorpus.smoke.path);
      await expect.poll(editor.scenario.runCount).toBe(nextRun);
      await editor.scenario.completeRun();
      await page.getByRole("button", { name: labels.backToUpload, exact: true }).click();
      await expect.poll(editor.scenario.resourceCounts).toEqual({
        artifacts: 0,
        leases: 0,
        objectUrls: 0,
      });
    }
  }
});
