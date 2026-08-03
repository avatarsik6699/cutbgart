import { expect, test } from "./support/v2/fixtures";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("Manual draft Cancel/Apply and document Undo/Redo stay local and atomic", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await editorV2.scenario.completeRun();
  await expect(page.getByRole("button", { name: "Manual cutout" })).toBeVisible();

  await page.getByRole("button", { name: "Manual cutout" }).click();
  const canvas = page.getByRole("img", { name: "Manual cutout canvas" });
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 1, y: 1 } });
  await expect(page.getByRole("button", { name: "Undo stroke" })).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo stroke" })).toBeEnabled();
  await page.keyboard.press("Control+Shift+z");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Image with background removed" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeDisabled();

  await page.getByRole("button", { name: "Manual cutout" }).click();
  await page
    .getByRole("img", { name: "Manual cutout canvas" })
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeEnabled();
  await expect.poll(editorV2.scenario.manualCommitCount).toBe(1);
  await expect.poll(editorV2.scenario.runCount).toBe(1);

  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo edit" })).toBeEnabled();
  await page.keyboard.press("Control+y");
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeEnabled();
  expect((await editorV2.exportPng.download()).suggestedFilename()).toBe(
    "sample-no-background.png",
  );

  await editorV2.preview.resetButton.click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});

test("Manual cutout controls are localized in Russian", async ({ editorV2, page }) => {
  await page.goto("/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await editorV2.scenario.completeRun();
  await page.getByRole("button", { name: "Ручная коррекция" }).click();
  await expect(page.getByRole("button", { name: "Восстановить" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Стереть" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Применить" })).toBeDisabled();
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
});

test("committed history prunes to twenty operations and releases all churn resources", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await editorV2.scenario.completeRun();

  for (let operation = 0; operation < 22; operation += 1) {
    await page.getByRole("button", { name: "Manual cutout" }).click();
    if (operation % 2 === 1) {
      await page.getByRole("button", { name: "Restore" }).click();
    }
    await page
      .getByRole("img", { name: "Manual cutout canvas" })
      .click({ position: { x: 1, y: 1 } });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText(`Document revision ${String(operation + 2)}`),
    ).toBeVisible();
  }

  let undoCount = 0;
  const undo = page.getByRole("button", { name: "Undo edit" });
  while (await undo.isEnabled()) {
    await undo.click();
    undoCount += 1;
  }
  expect(undoCount).toBe(20);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
  await expect.poll(editorV2.scenario.manualCommitCount).toBe(22);
  await editorV2.preview.resetButton.click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});
