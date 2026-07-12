import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

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

async function alphaAt(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(
    ({ sourceX, sourceY }) => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("mask correction canvas not found");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D context unavailable");
      const { data } = ctx.getImageData(sourceX, sourceY, 1, 1);
      return data[3] ?? -1;
    },
    { sourceX: x, sourceY: y },
  );
}

async function visibleCenterSourcePoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("mask correction canvas not found");
    const viewport = canvas.parentElement;
    if (!viewport) throw new Error("mask correction viewport not found");
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return {
      x: Math.floor(
        (viewportRect.left + viewportRect.width / 2 - canvasRect.left) *
          (canvas.width / canvasRect.width),
      ),
      y: Math.floor(
        (viewportRect.top + viewportRect.height / 2 - canvasRect.top) *
          (canvas.height / canvasRect.height),
      ),
    };
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
  test("keeps the completed result visible when worker-backed mask preparation fails", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const posts: unknown[] = [];
      Object.defineProperty(window, "__maskCorrectionWorkerPosts", {
        value: posts,
        configurable: true,
      });

      class MockWorker extends EventTarget {
        postMessage(message: {
          type: string;
          requestId?: string;
          qualityMode?: string;
          inferencePath?: string;
        }): void {
          posts.push(message);
          if (message.type === "load-model") {
            queueMicrotask(() => {
              this.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    type: "model-ready",
                    qualityMode: message.qualityMode,
                    inferencePath: message.inferencePath ?? "wasm",
                    dtype: "mock",
                  },
                }),
              );
            });
          }
          if (message.type === "process") {
            queueMicrotask(() => {
              this.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    type: "process-result",
                    requestId: message.requestId,
                    result: new Blob(["mock-png"], { type: "image/png" }),
                    durationMs: 1,
                  },
                }),
              );
            });
          }
          if (message.type === "extract-alpha-matte") {
            queueMicrotask(() => {
              this.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    type: "error",
                    code: "compositing-failed",
                    requestId: message.requestId,
                    message: "mock correction failure",
                  },
                }),
              );
            });
          }
        }

        terminate(): void {
          // no-op
        }
      }

      Object.defineProperty(window, "Worker", {
        value: MockWorker,
        configurable: true,
      });
    });

    await page.goto("/");
    const uploadInput = page.getByLabel("Upload an image");
    await expect(uploadInput).toBeEnabled();
    await uploadInput.setInputFiles(SAMPLE_IMAGE);
    await expect(
      page.getByRole("slider", { name: "Before/after comparison position" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /edit mask/i }).click();

    await expect(page.getByRole("alert")).toContainText(/could not prepare mask/i);
    await expect(page.getByRole("button", { name: /^download$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /edit mask/i })).toBeVisible();

    await page.getByRole("button", { name: /try again/i }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __maskCorrectionWorkerPosts: { type: string }[];
              }
            ).__maskCorrectionWorkerPosts.filter(
              (message) => message.type === "extract-alpha-matte",
            ).length,
        ),
      )
      .toBe(2);
  });

  test("enter correcting -> add/erase/restore each change the composite -> undo/redo -> done -> download reflects the correction", async ({
    page,
  }) => {
    await installMockInference(page);
    await page.goto("/");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);
    const beforeAfterSlider = page.getByRole("slider", {
      name: "Before/after comparison position",
    });
    await expect(beforeAfterSlider).toBeVisible();

    const preEditDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    const preEditDownload = await preEditDownloadPromise;
    const preEditPath = await preEditDownload.path();
    if (!preEditPath) throw new Error("pre-edit download did not save to disk");
    const preEditBytes = await readFile(preEditPath);

    await page.getByRole("button", { name: /edit mask/i }).click();
    await expect(page.getByRole("button", { name: /^done$/i })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/editing mask corrections/i);
    await expect(page.getByRole("status")).toContainText(/mask editor zoom 100%/i);

    const editor = page.getByRole("application", { name: /mask correction editor/i });
    await editor.focus();
    const browserScale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    await page.keyboard.press("ControlOrMeta+=");
    await page.keyboard.press("ControlOrMeta+=");
    await expect(page.getByRole("status")).toContainText(/mask editor zoom 150%/i);
    await expect
      .poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1))
      .toBe(browserScale);

    const canvasTransformBeforeWheel = await page
      .getByRole("img", { name: /mask correction canvas/i })
      .evaluate((canvas) => canvas.style.transform);
    const wheelPrevented = await editor.evaluate((element) => {
      const event = new WheelEvent("wheel", {
        deltaY: 80,
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(wheelPrevented).toBe(true);
    await expect
      .poll(() =>
        page
          .getByRole("img", { name: /mask correction canvas/i })
          .evaluate((canvas) => canvas.style.transform),
      )
      .not.toBe(canvasTransformBeforeWheel);

    const handPoint = await visibleCenterSourcePoint(page);
    const alphaBeforeHandPan = await alphaAt(page, handPoint.x, handPoint.y);
    const canvasForHandPan = page.getByRole("img", {
      name: /mask correction canvas/i,
    });
    const handBox = await canvasForHandPan.boundingBox();
    if (!handBox) throw new Error("mask correction canvas has no bounding box");
    await page.keyboard.down("Space");
    await page.mouse.move(handBox.x + handBox.width / 2, handBox.y + handBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      handBox.x + handBox.width / 2 - 20,
      handBox.y + handBox.height / 2 - 10,
    );
    await page.mouse.up();
    await page.keyboard.up("Space");
    expect(await alphaAt(page, handPoint.x, handPoint.y)).toBe(alphaBeforeHandPan);
    const brushCursor = editor.locator('[aria-hidden="true"]');
    await expect(brushCursor).toHaveCSS("opacity", "1");

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");

    const mappedPoint = await visibleCenterSourcePoint(page);
    const mappedOriginalAlpha = await alphaAt(page, mappedPoint.x, mappedPoint.y);
    const mappingMode = mappedOriginalAlpha === 255 ? "Erase" : "Add";
    const mappedExpectedAlpha = mappedOriginalAlpha === 255 ? 0 : 255;
    await page.getByLabel("Brush size").focus();
    await page.keyboard.press("Home");
    await page.getByRole("button", { name: mappingMode }).click();
    await dragOnCanvasCenter(page);
    await expect
      .poll(() => alphaAt(page, mappedPoint.x, mappedPoint.y))
      .toBe(mappedExpectedAlpha);
    await page.getByRole("button", { name: "Restore" }).click();
    await dragOnCanvasCenter(page);
    await expect
      .poll(() => alphaAt(page, mappedPoint.x, mappedPoint.y))
      .toBe(mappedOriginalAlpha);

    await page.getByRole("button", { name: "Reset view" }).click();
    await expect(page.getByRole("status")).toContainText(/mask editor zoom 100%/i);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByRole("status")).toContainText(/mask editor zoom 125%/i);
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.getByRole("status")).toContainText(/mask editor zoom 100%/i);

    // Max out the bounded brush radius and verify the UI's 150px diameter
    // contract while also exercising the slider's keyboard operability.
    const brushSize = page.getByLabel("Brush size");
    await expect(brushSize).toHaveAttribute("max", "75");
    await brushSize.focus();
    await page.keyboard.press("End");
    await expect(brushSize).toHaveValue("75");
    await expect(brushSize).toHaveAttribute("aria-valuetext", "150 px diameter");

    const originalAlpha = await stableCenterAlpha(page);

    // erase -> center alpha goes fully transparent.
    await page.getByRole("button", { name: "Erase" }).click();
    await dragOnCanvasCenter(page);
    await expect.poll(() => centerAlpha(page)).toBe(0);

    // add -> center alpha goes fully opaque.
    await page.getByRole("button", { name: "Add" }).click();
    await dragOnCanvasCenter(page);
    await expect.poll(() => centerAlpha(page)).toBe(255);

    // Cmd/Ctrl+Z reverts the "add" stroke back to the erased (0) state.
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => centerAlpha(page)).toBe(0);

    // Cmd/Ctrl+Shift+Z re-applies the "add" stroke.
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect.poll(() => centerAlpha(page)).toBe(255);

    // Ctrl+Y uses the same redo stack.
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => centerAlpha(page)).toBe(0);
    await page.keyboard.press("Control+y");
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
