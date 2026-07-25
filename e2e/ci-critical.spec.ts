import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const SAMPLE_IMAGE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

async function makeCorrectionWithUndoRedo(page: Page): Promise<void> {
  await page.getByRole("button", { name: /edit mask/i }).click();
  const canvas = page.getByRole("img", { name: /mask correction canvas/i });
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Mask correction canvas has no bounds");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y + 4, { steps: 4 });
  await page.mouse.up();

  const undo = page.getByRole("button", { name: /^undo/i });
  const redo = page.getByRole("button", { name: /^redo/i });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(redo).toBeEnabled();
  await redo.click();
  await page.getByRole("button", { name: /^done$/i }).click();
  await expect(
    page.getByRole("slider", { name: /before\/after comparison/i }),
  ).toBeVisible();
}

async function expectDownload(page: Page, buttonName: RegExp, filename: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName }).click();
  expect((await pending).suggestedFilename()).toBe(filename);
}

test("mocked Chromium critical path: single and batch edit, history, switch and download", async ({
  page,
}) => {
  await installMockInference(page);
  await page.goto("/en");

  const singleUpload = page.getByLabel("Upload an image");
  await expect(singleUpload).toBeEnabled();
  await singleUpload.setInputFiles(SAMPLE_IMAGE);
  await expect(
    page.getByRole("slider", { name: /before\/after comparison/i }),
  ).toBeVisible();
  await makeCorrectionWithUndoRedo(page);
  await expectDownload(page, /^download$/i, "result.png");

  await page.getByRole("button", { name: /process another image/i }).click();
  const batchUpload = page.getByLabel("Upload an image");
  await expect(batchUpload).toBeAttached();
  await batchUpload.setInputFiles([SAMPLE_IMAGE, SAMPLE_IMAGE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");

  const items = page.getByRole("button", {
    name: /select sample\.jpg for review/i,
  });
  await items.first().click();
  await expect(items.first()).toHaveAttribute("aria-pressed", "true");
  await items.nth(1).click();
  await expect(items.nth(1)).toHaveAttribute("aria-pressed", "true");

  await makeCorrectionWithUndoRedo(page);
  await expectDownload(page, /^download$/i, "result.png");
  await expectDownload(page, /^download all$/i, "cutbg-results.zip");
});
