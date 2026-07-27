import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "images",
  "document-photo-example.webp",
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
  const canvas = page.getByRole("img", { name: /mask correction canvas/i });
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
  await page.goto("/en/");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  const panel = page.getByTestId("cutout-tool-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel.getByRole("tab", { name: "Manual" }).click();

  const canvas = page.getByRole("img", { name: /mask correction canvas/i });
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const workspace = page.getByTestId("tool-workspace");
  const originalAlpha = await centerAlpha(canvas);
  expect(originalAlpha).toBe(255);

  const size = panel.getByRole("slider", { name: "Brush size" });
  await size.focus();
  await size.press("End");
  const preview = page.locator(
    '[data-testid="brush-size-stage-preview"][data-visible="true"]',
  );
  await expect(preview).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Manual canvas has no bounding box");
  await canvas.hover({ position: { x: canvasBox.width / 2, y: canvasBox.height / 2 } });
  await expect
    .poll(async () => {
      const previewBox = await preview
        .getByTestId("brush-size-stage-preview-ring")
        .boundingBox();
      if (!isMobile) {
        const cursorBox = await page.getByTestId("mask-brush-cursor").boundingBox();
        return Math.abs((previewBox?.width ?? 0) - (cursorBox?.width ?? 0));
      }
      const sourceWidth = await canvas.evaluate(
        (node) => (node as HTMLCanvasElement).width,
      );
      const currentCanvasBox = await canvas.boundingBox();
      const actualStampDiameter = 150 * ((currentCanvasBox?.width ?? 0) / sourceWidth);
      return Math.abs((previewBox?.width ?? 0) - actualStampDiameter);
    })
    .toBeLessThan(3);

  await panel.getByRole("button", { name: "Zoom in" }).click();
  await expect(panel.getByLabel(/Zoom 125%/)).toBeVisible();
  await panel.getByRole("button", { name: "Erase", exact: true }).click();
  await paintCenter(page);
  await expect.poll(() => centerAlpha(canvas)).toBe(0);
  await expect(panel.getByRole("button", { name: "Undo" })).toBeEnabled();

  await panel.getByRole("tab", { name: "Magic" }).click();
  await expect(page.getByTestId("guided-brush-selection")).toHaveAttribute(
    "data-zoom",
    "125",
  );
  await panel.getByRole("tab", { name: "Manual" }).click();
  await expect.poll(() => centerAlpha(canvas)).toBe(0);
  await expect(panel.getByRole("button", { name: "Undo" })).toBeEnabled();

  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect.poll(() => centerAlpha(canvas)).toBe(originalAlpha);
  await expect(workspace).toHaveAttribute("data-document-revision", "0");
  await expect(panel.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();

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
  );

  await page.getByRole("button", { name: /^Undo:/ }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "3");
  await page.getByRole("button", { name: /^Redo:/ }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "4");
});
