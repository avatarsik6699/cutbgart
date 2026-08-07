import { expect, test } from "./support/editor/fixtures";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("Manual draft Cancel/Apply and document Undo/Redo stay local and atomic", async ({
  editor,
  page,
}) => {
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editor.upload.choose(phase33ImageCorpus.representative.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();
  await expect(page.getByRole("tab", { name: "Manual" })).toBeVisible();

  await page.getByRole("tab", { name: "Manual" }).click();
  const canvas = page.getByRole("img", { name: "Manual cutout canvas" });
  await expect(canvas).toBeVisible();
  await canvas.hover({ position: { x: 80, y: 80 } });
  const brushCursor = page.getByTestId("manual-brush-cursor");
  const brushCursorBox = await brushCursor.boundingBox();
  if (brushCursorBox === null) throw new Error("Manual brush cursor is not visible");
  expect(Math.abs(brushCursorBox.width - brushCursorBox.height)).toBeLessThanOrEqual(1);
  await expect(brushCursor).toHaveCSS("border-top-color", "rgb(255, 255, 255)");
  await expect(brushCursor).toHaveCSS("border-top-style", "solid");
  await canvas.click({ position: { x: 1, y: 1 } });
  await expect(page.getByRole("button", { name: "Undo stroke" })).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo stroke" })).toBeEnabled();
  await page.keyboard.press("Control+Shift+z");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Manual" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: "Undo document change" })).toBeDisabled();

  await page.getByRole("tab", { name: "Manual" }).click();
  await page
    .getByRole("img", { name: "Manual cutout canvas" })
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("tab", { name: "Manual" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: "Undo document change" })).toBeEnabled();
  await expect.poll(editor.scenario.manualCommitCount).toBe(1);
  await expect.poll(editor.scenario.runCount).toBe(1);

  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo document change" })).toBeEnabled();
  await page.keyboard.press("Control+y");
  await expect(page.getByRole("button", { name: "Undo document change" })).toBeEnabled();
  expect((await editor.exportPng.download()).suggestedFilename()).toBe(
    "cutbg-result.png",
  );

  await editor.preview.resetButton.click();
  await expect.poll(editor.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});

test("Manual cutout controls are localized in Russian", async ({ editor, page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();
  await page.getByRole("tab", { name: "Вручную" }).click();
  await expect(page.getByRole("button", { name: "Восстановить" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Стереть" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Применить" })).toBeDisabled();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
});

test("committed history prunes to twenty operations and releases all churn resources", async ({
  editor,
  page,
}) => {
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();

  for (let operation = 0; operation < 22; operation += 1) {
    await page.getByRole("tab", { name: "Manual" }).click();
    const brushMode = operation % 2 === 0 ? "Erase" : "Restore";
    await page.getByRole("button", { name: brushMode, exact: true }).click();
    await page
      .getByRole("img", { name: "Manual cutout canvas" })
      .click({ position: { x: 1, y: 1 } });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText(`Document revision ${String(operation + 2)}`),
    ).toBeVisible();
  }

  let undoCount = 0;
  const undo = page.getByRole("button", { name: "Undo document change" });
  while (await undo.isEnabled()) {
    await undo.click();
    undoCount += 1;
  }
  expect(undoCount).toBe(20);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await expect.poll(editor.scenario.manualCommitCount).toBe(22);
  await editor.preview.resetButton.click();
  await expect.poll(editor.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});
