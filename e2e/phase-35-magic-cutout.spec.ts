import { expect, test } from "./support/v2/fixtures";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("Magic strokes predict separately and Apply creates exactly one document edit", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await editorV2.scenario.completeRun();

  await page.getByRole("button", { name: "Magic Cutout" }).click();
  const canvas = page.getByLabel("Paint Keep and Remove guidance on the image");
  await canvas.click({ position: { x: 1, y: 1 } });
  await expect(page.getByText("1/50 strokes")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo stroke" })).toBeEnabled();
  await page.keyboard.press("Control+Shift+z");

  await page.getByRole("button", { name: "Predict" }).click();
  await expect(page.getByRole("button", { name: "Candidate 1" })).toBeVisible();
  await expect.poll(editorV2.scenario.magicPredictionCount).toBe(1);
  await expect.poll(editorV2.scenario.magicCommitCount).toBe(0);
  await expect.poll(editorV2.scenario.runCount).toBe(1);

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await canvas.click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("button", { name: "Candidate 1" })).toBeHidden();
  await expect.poll(editorV2.scenario.magicPredictionCount).toBe(1);
  await page.getByRole("button", { name: "Predict" }).click();
  await expect(page.getByRole("button", { name: "Candidate 1" })).toBeVisible();
  await expect.poll(editorV2.scenario.magicPredictionCount).toBe(2);

  await page.getByRole("button", { name: "Candidate 1" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Document revision 2")).toBeVisible();
  await expect.poll(editorV2.scenario.magicCommitCount).toBe(1);
  await expect.poll(editorV2.scenario.magicPredictionCount).toBe(2);
  await expect.poll(editorV2.scenario.runCount).toBe(1);

  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo edit" })).toBeEnabled();
  await page.keyboard.press("Control+y");
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeEnabled();
  expect((await editorV2.exportPng.download()).suggestedFilename()).toBe(
    "cutbg-result.png",
  );

  await editorV2.preview.resetButton.click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});

test("dirty Magic Cancel asks before discarding and Russian controls are localized", async ({
  editorV2,
  page,
}) => {
  await page.goto("/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await editorV2.scenario.completeRun();
  await page.getByRole("button", { name: "Магическое вырезание" }).click();
  await page
    .getByLabel("Нарисуйте подсказки «Сохранить» и «Удалить» на изображении")
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Продолжить редактирование" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await page.getByRole("button", { name: "Отбросить черновик" }).click();
  await expect(page.getByRole("button", { name: "Магическое вырезание" })).toBeVisible();
  await expect.poll(editorV2.scenario.magicPredictionCount).toBe(0);
});
