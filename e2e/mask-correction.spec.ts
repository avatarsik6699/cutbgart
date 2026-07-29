import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icon-512.png",
);

test.beforeEach(async ({ page }) => installMockInference(page));

async function centerAlpha(canvas: Locator): Promise<number> {
  return canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement;
    const context = element.getContext("2d");
    if (!context) throw new Error("2D context unavailable");
    return (
      context.getImageData(
        Math.floor(element.width / 2),
        Math.floor(element.height / 2),
        1,
        1,
      ).data[3] ?? -1
    );
  });
}

async function paintCenter(page: Page): Promise<void> {
  const correctionViewport = page.getByTestId("mask-correction-viewport");
  const canvas = correctionViewport.getByRole("img", {
    name: /mask correction canvas/i,
  });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Manual canvas has no bounding box");
  await canvas.click({
    position: { x: box.width / 2, y: box.height / 2 },
  });
}

test("Manual keeps exact-alpha drafts, viewport state, Cancel, Apply, and document history separate", async ({
  page,
  isMobile,
}) => {
  test.slow();
  await page.goto("/en/");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  const panel = page.getByTestId("cutout-tool-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel.getByRole("tab", { name: "Manual" }).click();

  const correctionViewport = page.getByTestId("mask-correction-viewport");
  const canvas = correctionViewport.getByRole("img", {
    name: /mask correction canvas/i,
  });
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const checkerStyles = async (locator: typeof correctionViewport) =>
    locator.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        image: style.backgroundImage,
        position: style.backgroundPosition,
        size: style.backgroundSize,
      };
    });
  expect(await checkerStyles(correctionViewport)).toEqual(
    await checkerStyles(page.getByTestId("guided-brush-edit-frame")),
  );
  const workspace = page.getByTestId("tool-workspace");
  const originalAlpha = await centerAlpha(canvas);
  expect(originalAlpha).toBe(255);

  const size = panel.getByRole("slider", { name: "Brush size" });
  await size.focus();
  await size.press("End");
  const preview = page.locator(
    '[data-testid="brush-size-stage-preview"]:not([data-viewport-diameter="0"])',
  );
  await expect(preview).toHaveAttribute("data-visible", "true");
  await canvas.scrollIntoViewIfNeeded();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Manual canvas has no bounding box");
  await canvas.hover({ position: { x: canvasBox.width / 2, y: canvasBox.height / 2 } });
  await expect
    .poll(async () => {
      const previewDiameter = Number(
        await preview.getAttribute("data-viewport-diameter"),
      );
      if (!isMobile) {
        const cursorBox = await page.getByTestId("mask-brush-cursor").boundingBox();
        return Math.abs(previewDiameter - (cursorBox?.width ?? 0));
      }
      const sourceWidth = await canvas.evaluate(
        (node) => (node as HTMLCanvasElement).width,
      );
      const currentCanvasBox = await canvas.boundingBox();
      const actualStampDiameter = 150 * ((currentCanvasBox?.width ?? 0) / sourceWidth);
      return Math.abs(previewDiameter - actualStampDiameter);
    })
    .toBeLessThan(3);

  const viewControls = page.getByTestId("canvas-view-controls");
  await expect(viewControls.getByRole("button", { name: "Pan image" })).toBeDisabled();
  const geometryAtFit = await canvas.boundingBox();
  if (!geometryAtFit) throw new Error("Manual canvas has no fit geometry");
  await viewControls.getByRole("button", { name: "Zoom in" }).click();
  await expect(viewControls.getByLabel(/Zoom 125%/)).toBeVisible();
  await expect(viewControls.getByRole("button", { name: "Pan image" })).toBeEnabled();
  await viewControls.getByRole("button", { name: "Pan image" }).hover();
  await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText(
    /H.*Space \+ drag/,
  );
  await page.keyboard.press("h");
  await expect(
    viewControls.getByRole("button", { name: "Paint with brush" }),
  ).toBeVisible();
  await page.keyboard.press("b");
  await expect(viewControls.getByRole("button", { name: "Pan image" })).toBeVisible();
  await expect(page.getByTestId("mask-correction-viewport")).toHaveAttribute(
    "data-zoom",
    "125",
  );
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0)
    .toBeGreaterThan(geometryAtFit.width * 1.2);

  await viewControls.getByRole("button", { name: "Pan image" }).click();
  await page.mouse.move(
    geometryAtFit.x + geometryAtFit.width / 2,
    geometryAtFit.y + geometryAtFit.height / 2,
  );
  await expect
    .poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe("grab");
  const offsetBeforePan = await correctionViewport.getAttribute("data-offset-x");
  const panBox = await canvas.boundingBox();
  if (!panBox) throw new Error("Zoomed manual canvas has no bounding box");
  await page.mouse.move(panBox.x + panBox.width / 2, panBox.y + panBox.height / 2);
  await page.mouse.down();
  await expect
    .poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe("grabbing");
  await page.mouse.move(
    panBox.x + panBox.width / 2 + 30,
    panBox.y + panBox.height / 2 + 20,
    { steps: 3 },
  );
  await page.mouse.up();
  await expect
    .poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe("grab");
  await expect
    .poll(() => correctionViewport.getAttribute("data-offset-x"))
    .not.toBe(offsetBeforePan);

  await viewControls.getByRole("button", { name: "Fit image" }).click();
  await expect(viewControls.getByLabel(/Zoom 100%/)).toBeVisible();
  await expect(viewControls.getByRole("button", { name: "Pan image" })).toBeDisabled();
  await expect(correctionViewport).toHaveAttribute("data-offset-x", "0");
  await expect(correctionViewport).toHaveAttribute("data-offset-y", "0");
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0)
    .toBeCloseTo(geometryAtFit.width, 0);

  await viewControls.getByRole("button", { name: "Collapse view controls" }).click();
  await expect(viewControls).toHaveAttribute("data-collapsed", "true");
  await viewControls.getByRole("button", { name: "Expand view controls" }).click();
  await expect(viewControls).toHaveAttribute("data-collapsed", "false");

  await viewControls.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.getByTestId("editor-stage")).toHaveAttribute("data-expanded", "true");
  await viewControls.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(page.getByTestId("editor-stage")).toHaveAttribute(
    "data-expanded",
    "false",
  );

  await panel.getByRole("button", { name: "Erase", exact: true }).click();
  await paintCenter(page);
  await expect.poll(() => centerAlpha(canvas)).toBe(0);
  await expect(panel.getByRole("button", { name: "Undo" })).toHaveCount(0);

  const stageBounds = await page.getByTestId("editor-stage").boundingBox();
  await panel.getByRole("tab", { name: "Magic" }).click();
  expect(await page.getByTestId("editor-stage").boundingBox()).toEqual(stageBounds);
  await expect(page.getByTestId("guided-brush-selection")).toHaveAttribute(
    "data-zoom",
    "100",
  );
  await viewControls.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByTestId("guided-brush-selection")).toHaveAttribute(
    "data-zoom",
    "125",
  );
  await viewControls.getByRole("button", { name: "Fit image" }).click();
  await panel.getByRole("tab", { name: "Manual" }).click();
  expect(await page.getByTestId("editor-stage").boundingBox()).toEqual(stageBounds);
  await expect.poll(() => centerAlpha(canvas)).toBe(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => centerAlpha(canvas)).toBe(originalAlpha);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => centerAlpha(canvas)).toBe(0);

  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect.poll(() => centerAlpha(canvas)).toBe(originalAlpha);
  await expect(workspace).toHaveAttribute("data-document-revision", "0");
  await expect(panel.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();

  await page.getByTestId("editor-stage").evaluate((node) => {
    node.dataset.persistenceMarker = "manual-stage";
  });
  await canvas.evaluate((node) => {
    node.dataset.persistenceMarker = "manual-canvas";
  });
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await expect(page.getByTestId("editor-stage")).toHaveAttribute(
    "data-persistence-marker",
    "manual-stage",
  );
  await expect(
    page.getByRole("img", { name: /mask correction canvas/i, includeHidden: true }),
  ).toHaveAttribute("data-persistence-marker", "manual-canvas");
  await page.getByRole("button", { name: "Cutout", exact: true }).click();
  await expect(panel.getByRole("tab", { name: "Manual" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(canvas).toHaveAttribute("data-persistence-marker", "manual-canvas");

  await panel.getByRole("button", { name: "Erase", exact: true }).click();
  await paintCenter(page);
  await expect.poll(() => centerAlpha(canvas)).toBe(0);
  await panel.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "1");
  await expect(panel.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();

  await panel.getByRole("button", { name: "Restore", exact: true }).click();
  await paintCenter(page);
  await expect.poll(() => centerAlpha(canvas)).toBe(255);
  await panel.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "2");

  await panel.getByRole("button", { name: "Erase", exact: true }).click();
  await paintCenter(page);
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await expect(page.getByTestId("editor-draft-guard")).toBeVisible();
  await expect(workspace).toHaveAttribute("data-document-revision", "2");
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByTestId("tool-panel-slot")).toHaveAttribute(
    "data-active-tool",
    "enhance",
    { timeout: 15_000 },
  );

  const undoDocument = page.getByRole("button", { name: /^Undo:/ });
  await undoDocument.click();
  await expect(workspace).toHaveAttribute("data-document-revision", "3", {
    timeout: 30_000,
  });
});
