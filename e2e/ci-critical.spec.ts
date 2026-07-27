import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { expectAutomaticCutout, openManualCutout } from "./support/editor-ui";
import { installMockInference } from "./support/mock-inference";

const SAMPLE_IMAGE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

async function makeCorrectionWithUndoRedo(page: Page): Promise<void> {
  const workspace = page.getByTestId("tool-workspace");
  const revisionBefore = Number(await workspace.getAttribute("data-document-revision"));
  const canvas = await openManualCutout(page);
  const correctionPanel = page.getByTestId("tool-panel-slot");
  await correctionPanel.getByRole("button", { name: /^erase$/i }).click();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Mask correction canvas has no bounds");
  const point = {
    clientX: bounds.x + bounds.width / 2,
    clientY: bounds.y + bounds.height / 2,
  };
  // The CI fixture is intentionally 1×1. Chromium/Firefox hit-test its
  // stretched canvas against the surrounding stage differently, so use an
  // explicit pointer pair here; the full mask-correction spec covers real
  // pointer movement on the normal editing surface in every browser.
  await canvas.dispatchEvent("pointerdown", {
    ...point,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 1,
  });
  await canvas.dispatchEvent("pointerup", {
    ...point,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 0,
  });
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const surface = element as HTMLCanvasElement;
        return surface
          .getContext("2d")
          ?.getImageData(
            Math.floor(surface.width / 2),
            Math.floor(surface.height / 2),
            1,
            1,
          ).data[3];
      }),
    )
    .toBeLessThan(255);

  const undo = correctionPanel.getByRole("button", { name: /^undo$/i });
  const redo = correctionPanel.getByRole("button", { name: /^redo$/i });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(redo).toBeEnabled();
  await redo.click();
  await correctionPanel.getByRole("button", { name: /^apply$/i }).click();
  await expect(workspace).toHaveAttribute(
    "data-document-revision",
    String(revisionBefore + 1),
  );
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
  await expectAutomaticCutout(page);
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
