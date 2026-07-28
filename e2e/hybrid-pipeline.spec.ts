import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  applyMagicPass,
  expectAutomaticCutout,
  expectComparisonForTool,
} from "./support/editor-ui";
import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.beforeEach(async ({ page }) => installMockInference(page));

const UI = {
  upload: /Upload an image|Загрузить изображения/,
  cutout: /^(?:Cutout|Вырезание)$/,
  enhance: /^(?:Enhancements|Улучшения)$/,
  manual: /^(?:Manual|Вручную)$/,
  apply: /^(?:Apply|Применить)$/,
  applied: /Enhancements applied|Улучшения применены/i,
  fine: /Improve fine details|Улучшить мелкие детали/i,
  halo: /Remove colour halo|Убрать цветной ореол/i,
  history: {
    cutout: /^(?:Undo: Cutout|Отменить: Вырезание)$/,
    manual: /^(?:Undo: Manual|Отменить: Ручная правка)$/,
    enhance: /^(?:Undo: Enhancements|Отменить: Улучшения)$/,
    redoCutout: /^(?:Redo: Cutout|Вернуть: Вырезание)$/,
    redoManual: /^(?:Redo: Manual|Вернуть: Ручная правка)$/,
    redoEnhance: /^(?:Redo: Enhancements|Вернуть: Улучшения)$/,
  },
} as const;

async function documentRevision(page: Page): Promise<number> {
  const value = await page
    .getByTestId("tool-workspace")
    .getAttribute("data-document-revision");
  return Number(value ?? -1);
}

async function paintManualCenter(page: Page): Promise<void> {
  const canvas = page.getByRole("img", {
    name: /mask correction canvas|холст коррекции/i,
  });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Mask correction canvas has no bounding box");
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
}

async function applyManualPass(page: Page): Promise<void> {
  await page.getByRole("button", { name: UI.cutout }).click();
  await page.getByRole("tab", { name: UI.manual }).click();
  const canvas = page.getByRole("img", {
    name: /mask correction canvas|холст коррекции/i,
  });
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: /^(?:Erase|Стереть)$/ }).click();
  await paintManualCenter(page);
  const before = await documentRevision(page);
  await page
    .getByTestId("cutout-tool-panel")
    .getByRole("button", {
      name: UI.apply,
    })
    .click();
  await expect.poll(() => documentRevision(page)).toBe(before + 1);
}

async function openEnhancements(page: Page): Promise<Locator> {
  await expectComparisonForTool(page, UI.enhance);
  const panel = page.getByTestId("enhancements-tool-panel");
  await expect(panel.getByRole("checkbox", { name: UI.fine })).toBeChecked();
  await expect(panel.getByRole("checkbox", { name: UI.halo })).toBeChecked();
  await expect(panel).not.toContainText(
    /Refine soft edges|Clean edge colours|Skip and edit with brush|ViTMatte|provider|graph|WebGPU|WASM|MiB/i,
  );
  return panel;
}

async function applyEnhancements(page: Page): Promise<void> {
  const panel = await openEnhancements(page);
  const before = await documentRevision(page);
  await panel.getByRole("button", { name: UI.apply }).click();
  await expect(panel.getByText(UI.applied)).toBeVisible();
  await expect.poll(() => documentRevision(page)).toBe(before + 1);
}

test("Cutout, Manual, and Enhancements share one committed undo/redo history", async ({
  page,
}) => {
  await page.goto("/en");
  const upload = page.getByLabel(UI.upload);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);

  await applyMagicPass(page);
  await applyManualPass(page);
  await applyEnhancements(page);
  await expect.poll(() => documentRevision(page)).toBe(3);

  await page.getByRole("button", { name: UI.history.enhance }).click();
  await expect(page.getByRole("button", { name: UI.history.manual })).toBeEnabled();
  await page.getByRole("button", { name: UI.history.manual }).click();
  await expect(page.getByRole("button", { name: UI.history.cutout })).toBeEnabled();
  await page.getByRole("button", { name: UI.history.cutout }).click();
  await expect(
    page.getByRole("button", {
      name: /Undo document change|Отменить изменение документа/i,
    }),
  ).toBeDisabled();

  await page.getByRole("button", { name: UI.history.redoCutout }).click();
  await page.getByRole("button", { name: UI.history.redoManual }).click();
  await page.getByRole("button", { name: UI.history.redoEnhance }).click();
  await expect.poll(() => documentRevision(page)).toBe(9);
});

test("Enhancements Apply and history remain isolated for two selected batch items", async ({
  page,
}) => {
  await page.goto("/");
  const upload = page.getByLabel(UI.upload);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([SAMPLE, SAMPLE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText(/2 done|готово 2/);
  const items = page.getByRole("button", {
    name: /select sample\.jpg for review|выбрать sample\.jpg для просмотра/i,
  });

  await items.nth(0).click();
  await applyEnhancements(page);
  await page.getByRole("button", { name: UI.history.enhance }).click();
  await expect(page.getByRole("button", { name: UI.history.redoEnhance })).toBeEnabled();

  await items.nth(1).click();
  await expect(
    page.getByRole("button", {
      name: /Undo document change|Отменить изменение документа/i,
    }),
  ).toBeDisabled();
  await applyEnhancements(page);
  await page.getByRole("button", { name: UI.history.enhance }).click();

  await items.nth(0).click();
  await expect(page.getByRole("button", { name: UI.history.redoEnhance })).toBeEnabled();
});

test("Cancel and retry keep the last committed document until one atomic Apply succeeds", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__mockDelayMattingResponse", {
      configurable: true,
      writable: true,
      value: true,
    });
  });
  await page.goto("/en");
  const upload = page.getByLabel(UI.upload);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);
  const panel = await openEnhancements(page);

  await panel.getByRole("button", { name: UI.apply }).click();
  await expect(
    panel.getByRole("button", { name: /Applying…|Применение…/i }),
  ).toBeDisabled();
  await expect(panel.getByRole("button", { name: /^(?:Cancel|Отмена)$/ })).toBeEnabled();
  await panel.getByRole("button", { name: /^(?:Cancel|Отмена)$/ }).click();
  await expect(
    panel.getByText(/current result was kept|текущий результат сохранён/i),
  ).toBeVisible();
  await expect.poll(() => documentRevision(page)).toBe(0);

  await page.evaluate(() => {
    (
      window as unknown as { __mockDelayMattingResponse: boolean }
    ).__mockDelayMattingResponse = false;
    Object.defineProperty(window, "__mockForegroundFailure", {
      configurable: true,
      writable: true,
      value: true,
    });
  });
  await panel.getByRole("button", { name: UI.apply }).click();
  await expect(panel.getByRole("alert")).toContainText(
    /could not be completed|не удалось завершить/i,
  );
  await expect.poll(() => documentRevision(page)).toBe(0);

  await page.evaluate(() => {
    (window as unknown as { __mockForegroundFailure: boolean }).__mockForegroundFailure =
      false;
  });
  await panel.getByRole("button", { name: /Try again|Повторить/i }).click();
  await expect(panel.getByText(UI.applied)).toBeVisible();
  await expect.poll(() => documentRevision(page)).toBe(1);
});
