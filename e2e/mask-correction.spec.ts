import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");

async function centerAlpha(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("mask correction canvas not found");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    const { width, height } = canvas;
    const { data } = ctx.getImageData(
      Math.floor(width / 2),
      Math.floor(height / 2),
      1,
      1,
    );
    return data[3] ?? -1;
  });
}

/**
 * The correction canvas's first paint races an async `createImageBitmap`
 * decode of the source image (see MaskCorrectionCanvas.tsx) — reads a
 * snapshot value once it's stable across consecutive polls, instead of
 * trusting a single read that might land before the decode settles.
 */
async function stableCenterAlpha(page: Page): Promise<number> {
  let previous = await centerAlpha(page);
  await expect
    .poll(async () => {
      const current = await centerAlpha(page);
      const stable = current === previous;
      previous = current;
      return stable;
    })
    .toBe(true);
  return previous;
}

async function dragOnCanvasCenter(page: Page): Promise<void> {
  const canvas = page.getByRole("img", { name: /mask correction canvas/i });
  // The toolbar's mode-description text changes length per mode, so clicking
  // a mode button can reflow the page and leave the canvas scrolled out of
  // view by the time this runs — scroll it back into view before measuring.
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("mask correction canvas has no bounding box");
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 3, centerY + 3, { steps: 3 });
  await page.mouse.up();
}

test.describe("mask correction", () => {
  test("enter correcting -> add/erase/restore each change the composite -> undo/redo -> done -> download reflects the correction", async ({
    page,
  }) => {
    // Real model download + inference, same as e2e/home.spec.ts's critical
    // path — this is the automated stand-in for the architect's manual
    // browser check (AGENTS.md core rule 8), not a fast unit test.
    test.setTimeout(10 * 60 * 1000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Upload an image").setInputFiles(SAMPLE_IMAGE);
    const beforeAfterSlider = page.getByRole("slider", {
      name: "Before/after comparison position",
    });
    await expect(beforeAfterSlider).toBeVisible({ timeout: 5 * 60 * 1000 });

    const preEditDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    const preEditDownload = await preEditDownloadPromise;
    const preEditPath = await preEditDownload.path();
    if (!preEditPath) throw new Error("pre-edit download did not save to disk");
    const preEditBytes = await readFile(preEditPath);

    await page.getByRole("button", { name: /edit mask/i }).click();
    await expect(page.getByRole("button", { name: /^done$/i })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/editing mask corrections/i);

    // Max out the brush radius (also exercises the size slider's own keyboard
    // operability, SPEC.md §5.4/Phase 07 F6) so every stroke below covers the
    // whole canvas uniformly — the exact on-screen drag coordinates only need
    // to land inside the canvas, not on one precise pixel, which is what
    // "observably changes the composite" (this spec's Gate Checks wording)
    // actually calls for, not byte-exact pixel addressing (already covered by
    // entities/processed-image's `applyBrushStroke` unit tests).
    await page.getByLabel("Brush size").focus();
    await page.keyboard.press("End");

    const originalAlpha = await stableCenterAlpha(page);

    // erase -> center alpha goes fully transparent.
    await page.getByRole("button", { name: "Erase" }).click();
    await dragOnCanvasCenter(page);
    await expect.poll(() => centerAlpha(page)).toBe(0);

    // add -> center alpha goes fully opaque.
    await page.getByRole("button", { name: "Add" }).click();
    await dragOnCanvasCenter(page);
    await expect.poll(() => centerAlpha(page)).toBe(255);

    // undo reverts the "add" stroke back to the erased (0) state.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => centerAlpha(page)).toBe(0);

    // redo re-applies the "add" stroke.
    await page.getByRole("button", { name: "Redo" }).click();
    await expect.poll(() => centerAlpha(page)).toBe(255);

    // restore -> back to the model's original (pre-correction) alpha.
    await page.getByRole("button", { name: "Restore" }).click();
    await dragOnCanvasCenter(page);
    await expect.poll(() => centerAlpha(page)).toBe(originalAlpha);

    // Leave the matte in a state that's *guaranteed* to differ from
    // originalAlpha before downloading — restoring to the pristine value
    // above means the composite (correctly) matches the pre-edit download at
    // that point, so the final download-diff check below needs one more,
    // deliberately-different edit rather than asserting right after restore.
    const finalMode = originalAlpha === 255 ? "Erase" : "Add";
    const finalAlpha = originalAlpha === 255 ? 0 : 255;
    await page.getByRole("button", { name: finalMode }).click();
    await dragOnCanvasCenter(page);
    await expect.poll(() => centerAlpha(page)).toBe(finalAlpha);

    await page.getByRole("button", { name: /^done$/i }).click();
    await expect(beforeAfterSlider).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/background removed/i);

    const postEditDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    const postEditDownload = await postEditDownloadPromise;
    expect(postEditDownload.suggestedFilename()).toBe("result.png");
    const postEditPath = await postEditDownload.path();
    if (!postEditPath) throw new Error("post-edit download did not save to disk");
    const postEditBytes = await readFile(postEditPath);

    expect(postEditBytes.equals(preEditBytes)).toBe(false);
  });
});
