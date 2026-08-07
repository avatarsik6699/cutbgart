import { expect, test } from "./support/editor/fixtures";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("Magic Apply predicts the best candidate and creates exactly one document edit", async ({
  editor,
  page,
}) => {
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();

  await expect(page.getByRole("tab", { name: "Magic" })).toBeVisible();
  const canvas = page.getByLabel("Paint Keep and Remove guidance on the image");
  const currentImage = page.getByRole("img", {
    name: "Image with background removed",
  });
  const baselineResultUrl = await currentImage.getAttribute("src");
  await canvas.click({ position: { x: 1, y: 1 } });
  const undo = page.getByRole("button", { name: "Undo stroke" });
  const redo = page.getByRole("button", { name: "Redo stroke" });
  await expect(undo).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect(redo).toBeEnabled();
  await page.keyboard.press("Control+Shift+z");

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await canvas.click({ position: { x: 2, y: 2 } });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Document revision 2")).toBeVisible();
  await expect.poll(() => currentImage.getAttribute("src")).not.toBe(baselineResultUrl);
  await expect.poll(editor.scenario.magicCommitCount).toBe(1);
  await expect.poll(editor.scenario.magicPredictionCount).toBe(1);
  await expect.poll(editor.scenario.runCount).toBe(1);

  const documentUndo = page.getByRole("button", { name: "Undo document change" });
  const documentRedo = page.getByRole("button", { name: "Redo document change" });

  await page.keyboard.press("Control+z");
  await expect(documentRedo).toBeEnabled();
  await page.keyboard.press("Control+y");
  await expect(documentUndo).toBeEnabled();
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

test("Magic keeps a non-square image fully fitted and supports Space panning", async ({
  editor,
  page,
}) => {
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editor.upload.choose(phase33ImageCorpus.representative.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();

  const canvas = page.getByLabel("Paint Keep and Remove guidance on the image");
  const viewport = page.getByTestId("cutout-stage-viewport");
  const content = page.getByTestId("cutout-stage-content");
  expect(
    await viewport.evaluate(
      (element) =>
        element.scrollWidth === element.clientWidth &&
        element.scrollHeight === element.clientHeight,
    ),
  ).toBe(true);
  expect(
    await viewport.evaluate((element) => {
      const contentElement = element.querySelector<HTMLElement>(
        '[data-testid="cutout-stage-content"]',
      );
      if (contentElement === null) return false;
      const viewportRect = element.getBoundingClientRect();
      const contentRect = contentElement.getBoundingClientRect();
      return (
        contentRect.left >= viewportRect.left - 1 &&
        contentRect.top >= viewportRect.top - 1 &&
        contentRect.right <= viewportRect.right + 1 &&
        contentRect.bottom <= viewportRect.bottom + 1
      );
    }),
  ).toBe(true);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.keyboard.down("Space");
  await expect(viewport).toHaveAttribute("data-space-panning", "true");
  await expect(canvas).toHaveCSS("cursor", "grab");
  const transformBeforePan = await content.evaluate((element) => element.style.transform);
  const canvasBox = await canvas.boundingBox();
  if (canvasBox === null) throw new Error("Magic canvas is not visible");
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2 + 30,
    canvasBox.y + canvasBox.height / 2 + 20,
  );
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect
    .poll(() => content.evaluate((element) => element.style.transform))
    .not.toBe(transformBeforePan);

  await page.getByRole("button", { name: "Fit image" }).click();
  await canvas.hover({ position: { x: 80, y: 80 } });
  const brushCursor = page.getByTestId("magic-brush-cursor");
  const brushCursorBox = await brushCursor.boundingBox();
  if (brushCursorBox === null) throw new Error("Magic brush cursor is not visible");
  expect(Math.abs(brushCursorBox.width - brushCursorBox.height)).toBeLessThanOrEqual(1);
  await expect(brushCursor).toHaveCSS("border-top-style", "solid");

  await editor.preview.resetButton.click();
  await expect.poll(editor.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});

test("dirty Magic Cancel asks before discarding and Russian controls are localized", async ({
  editor,
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();
  await expect(page.getByRole("tab", { name: "Магия" })).toBeVisible();
  await page
    .getByLabel("Нарисуйте подсказки «Сохранить» и «Удалить» на изображении")
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Продолжить редактирование" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("button", { name: "Отбросить черновик" }).click();
  await expect(page.getByRole("tab", { name: "Магия" })).toBeVisible();
  await expect.poll(editor.scenario.magicPredictionCount).toBe(0);
});
