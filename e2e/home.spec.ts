import path from "node:path";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  expectAutomaticCutout,
  expectComparisonForTool,
  openManualCutout,
} from "./support/editor-ui";
import { installMockInference } from "./support/mock-inference";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");
const UNSUPPORTED_FILE = path.join(__dirname, "fixtures", "unsupported.txt");
const EDITOR_LOCALES = [
  {
    path: "/en",
    modes: [/^Fast/i, /^Optimal/i, /^Maximum quality/i],
    help: /About Maximum quality/i,
    helpBody: /compatible WebGPU/i,
    cutout: /^Cutout$/,
    enhance: /^Enhancements$/,
    background: /^Background$/,
    close: /^Close$/,
  },
  {
    path: "/",
    modes: [/^Быстро/i, /^Оптимально/i, /^Максимальное качество/i],
    help: /О максимальном качестве/i,
    helpBody: /совместимый WebGPU/i,
    cutout: /^Вырезание$/,
    enhance: /^Улучшения$/,
    background: /^Фон$/,
    close: /^Закрыть$/,
  },
] as const;

async function saveBackground(page: import("@playwright/test").Page) {
  const applyButton = page
    .getByTestId("background-tool-panel")
    .getByRole("button", { name: /^(?:Apply|Применить)$/ });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();
  await expect(applyButton).toBeDisabled();
}

async function inspectDownloadedPng(
  page: import("@playwright/test").Page,
  trigger = page.getByRole("button", { name: /^download$/i }),
) {
  await expect(page.getByRole("button", { name: /^download$/i })).toBeEnabled();
  const pending = page.waitForEvent("download");
  await trigger.click();
  const download = await pending;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Downloaded PNG path is unavailable");
  const bytes = Array.from(await readFile(downloadPath));
  const image = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(data)], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      corner: Array.from(context.getImageData(0, 0, 1, 1).data),
    };
    bitmap.close();
    return result;
  }, bytes);
  return { ...image, fileName: download.suggestedFilename() };
}

async function downloadedCorner(page: import("@playwright/test").Page) {
  return (await inspectDownloadedPng(page)).corner;
}

async function createLargePng(
  page: import("@playwright/test").Page,
  name: string,
  width = 2500,
  height = 1250,
) {
  const bytes = await page.evaluate(
    async ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#3366CC";
      context.fillRect(0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("Could not create fixture")),
          "image/png",
        ),
      );
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    { width, height },
  );
  return { name, mimeType: "image/png", buffer: Buffer.from(bytes) };
}

test.describe("/ (home)", () => {
  test.beforeEach(async ({ page }) => {
    await installMockInference(page);
  });
  test("renders the idle state with the quality toggle and upload controls", async ({
    page,
  }) => {
    await page.goto("/en");

    await expect(page.getByTestId("home-page")).toBeVisible();
    const brandLogos = page.getByRole("img", { name: "cutbg" });
    await expect(brandLogos).toHaveCount(2);
    await expect(brandLogos.first()).toHaveJSProperty("complete", true);
    await expect(brandLogos.first()).toHaveJSProperty("naturalWidth", 1100);
    await expect(page.getByTestId("processing-mode-selector")).toBeVisible();
    await expect(page.getByLabel("Upload an image")).toBeAttached();
  });

  test("idle upload workspace stays centered across breakpoints", async ({ page }) => {
    await page.goto("/en");
    const workspace = page.getByTestId("tool-workspace");
    await expect(workspace).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    const mobileColumns = await workspace.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    expect(mobileColumns).toBe(1);

    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopColumns = await workspace.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    expect(desktopColumns).toBe(1);
    const uploadBox = await page
      .getByLabel("Upload an image")
      .locator("..")
      .boundingBox();
    expect(uploadBox).not.toBeNull();
    if (uploadBox) {
      expect(Math.abs(uploadBox.x + uploadBox.width / 2 - 640)).toBeLessThan(2);
    }
  });

  test("shows a clear error for an unsupported file format without starting the model pipeline", async ({
    page,
  }) => {
    await page.goto("/en");
    // Hydration guard (docs/KNOWN_GOTCHAS.md): the input's onChange handler
    // only runs once React attaches it, so wait for the bundle to settle
    // before driving the file input.
    await expect(page.getByLabel("Upload an image")).toBeEnabled();

    await page.getByLabel("Upload an image").setInputFiles(UNSUPPORTED_FILE);

    await expect(page.getByRole("alert")).toContainText(/unsupported file format/i);
    // Never reaches model-loading — no progress UI should appear.
    await expect(page.getByText(/loading .* model/i)).toHaveCount(0);
  });

  test("critical path: upload -> process -> download -> process another image", async ({
    page,
  }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);

    await expectAutomaticCutout(page);
    await expect(page.getByRole("button", { name: /download/i })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("result.png");

    await page.getByRole("button", { name: "Output options" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Original" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("menuitemradio", { name: /2048|1024/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /process another image/i }).click();
    // `toBeAttached`, not `toBeVisible`: UploadDropzone (this locator) is
    // `hidden sm:flex` — ChoosePhotoButton is the visible control on narrow
    // viewports (e.g. the Mobile Safari project). Matches the same pattern
    // used for this locator in the idle-state test above.
    await expect(page.getByLabel("Upload an image")).toBeAttached();
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  for (const locale of EDITOR_LOCALES) {
    test(`automatic-first editor shell is stable and keyboard reachable (${locale.path})`, async ({
      page,
    }, testInfo) => {
      await page.goto(locale.path);
      const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
      await expect(upload).toBeEnabled();
      await expect(
        page.getByRole("button", { name: /Guide with a brush|Указать кистью/ }),
      ).toHaveCount(0);

      for (const mode of locale.modes) {
        await page.getByRole("radio", { name: mode }).click();
        await expect(page.getByRole("radio", { name: mode })).toBeChecked();
      }
      await page.getByRole("radio", { name: locale.modes[0] }).click();
      const help = page.getByRole("button", { name: locale.help });
      await help.dispatchEvent("click");
      await expect(page.getByText(locale.helpBody)).toBeVisible();
      await page.getByRole("button", { name: locale.close }).click();
      await expect(page.getByText(locale.helpBody)).toBeHidden();
      await help.hover();
      await expect(page.getByText(locale.helpBody)).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(page.getByText(locale.helpBody)).toBeHidden();
      if (!testInfo.project.use.isMobile) {
        await upload.focus();
        await help.focus();
        await expect(page.getByText(locale.helpBody)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByText(locale.helpBody)).toBeHidden();
      }

      await upload.setInputFiles(SAMPLE_IMAGE);
      await expectAutomaticCutout(page);
      const stage = page.getByTestId("editor-stage");
      await expect(stage).toBeVisible();
      await stage.evaluate((node) => {
        node.setAttribute("data-stability-probe", "mounted");
      });
      const initialBox = await stage.boundingBox();
      const slider = await expectComparisonForTool(page, locale.enhance);
      await slider.press("ArrowRight");
      await expect(slider).toHaveAttribute("aria-valuenow", "55");

      const cutout = page.getByRole("button", { name: locale.cutout });
      await cutout.click();
      await cutout.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("button", { name: locale.enhance })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("tool-panel-slot")).toHaveAttribute(
        "data-active-tool",
        "enhance",
      );
      await page.getByRole("button", { name: locale.background }).click();
      await expect(page.getByTestId("tool-panel-slot")).toHaveAttribute(
        "data-active-tool",
        "background",
      );
      await expect(stage).toHaveAttribute("data-stability-probe", "mounted");
      await expect(slider).toHaveAttribute("aria-valuenow", "55");
      const finalBox = await stage.boundingBox();
      expect(initialBox).not.toBeNull();
      expect(finalBox).not.toBeNull();
      if (initialBox && finalBox) {
        expect(Math.abs(initialBox.width - finalBox.width)).toBeLessThan(1);
        expect(Math.abs(initialBox.height - finalBox.height)).toBeLessThan(1);
      }
      await expect(page.getByTestId("tool-workspace")).not.toContainText(
        /IS-Net|BEN2|dtype|MiB|WebGPU|WASM/,
      );
    });
  }

  test("background replacement updates preview and downloaded PNG for color, gradient, and uploaded image", async ({
    page,
  }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);
    await expectAutomaticCutout(page);
    await page.getByRole("button", { name: /^Background$/ }).click();
    await expect(
      page.getByRole("slider", { name: /before\/after comparison/i }),
    ).toBeVisible();
    const preview = page.getByTestId("after-preview-background");
    await expect(page.getByTestId("fill-swatch")).toHaveCount(8);

    await page.getByRole("button", { name: "Background color" }).click();
    const palette = page.getByRole("slider", {
      name: "Color saturation and brightness",
    });
    const hue = page.getByRole("slider", { name: "Color hue" });
    // Phase 12's two-column desktop grid (`lg:grid-cols-[3fr_2fr]`) puts this
    // control further down the page than the pre-Phase-12 single-column
    // layout did — unlike `.click()`, raw `page.mouse.move()` coordinates
    // don't auto-scroll, so the target must be brought into view first or
    // the computed bounds can point below the fold.
    await palette.scrollIntoViewIfNeeded();
    const paletteBounds = await palette.boundingBox();
    expect(paletteBounds).not.toBeNull();
    if (!paletteBounds) throw new Error("Color palette has no bounds");
    await page.mouse.move(
      paletteBounds.x + paletteBounds.width * 0.25,
      paletteBounds.y + 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      paletteBounds.x + paletteBounds.width * 0.6,
      paletteBounds.y + 2,
    );
    await page.mouse.move(paletteBounds.x + paletteBounds.width - 1, paletteBounds.y + 1);
    await page.mouse.up();
    await hue.press("ArrowRight");

    await expect(palette).toBeVisible();
    await expect(page.getByTestId("color-palette-thumb")).toHaveAttribute(
      "style",
      /left: 99/,
    );
    await expect(preview).toHaveCSS("background-color", /rgb\(25\d, \d+, \d+\)/);
    await expect(preview).toHaveCSS("background-image", "none");
    await expect(page.getByRole("button", { name: "Ocean" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /^download$/i })).toBeEnabled();
    const committedBeforeApply = await downloadedCorner(page);
    expect(committedBeforeApply[0]).toBeGreaterThan(240);
    expect(committedBeforeApply[1]).toBeGreaterThan(240);
    expect(committedBeforeApply[2]).toBeGreaterThan(240);
    await page
      .getByTestId("background-tool-panel")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(
      page
        .getByTestId("background-tool-panel")
        .getByRole("button", { name: "Transparent" }),
    ).toHaveAttribute("aria-pressed", "true");

    await palette.click({
      position: { x: paletteBounds.width * 0.9, y: paletteBounds.height * 0.05 },
    });
    await saveBackground(page);
    const colorPixel = await downloadedCorner(page);
    expect(colorPixel[0]).toBeGreaterThan(240);
    // The deterministic matte keeps a small amount of the source pixel at the
    // corner, so assert a strongly red composite rather than an exact fill.
    expect(colorPixel[1]).toBeLessThan(110);
    expect(colorPixel[2]).toBeLessThan(110);
    expect(colorPixel[3]).toBe(255);

    const correctionCanvas = await openManualCutout(page);
    await expect(correctionCanvas).toHaveCSS(
      "background-color",
      /rgb\(2[34]\d, \d+, \d+\)/,
    );
    await page.getByRole("button", { name: /^cancel$/i }).click();

    await page.getByRole("button", { name: /^Background$/ }).click();
    await page.getByRole("button", { name: "Ocean" }).click();
    await expect(preview).toHaveCSS("background-image", /linear-gradient/);
    await saveBackground(page);
    const gradientPixel = await downloadedCorner(page);
    expect(gradientPixel).not.toEqual(colorPixel);

    await page.getByLabel("Custom background image").setInputFiles(SAMPLE_IMAGE);
    await expect(preview).toHaveCSS("background-image", /blob:/);
    await saveBackground(page);
    const imagePixel = await downloadedCorner(page);
    expect(imagePixel).not.toEqual(gradientPixel);
  });

  test("batch: upload multiple, select, reprocess, download one and all", async ({
    page,
  }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles([SAMPLE_IMAGE, SAMPLE_IMAGE, SAMPLE_IMAGE]);

    await expect(page.getByTestId("scheduler-summary")).toContainText("3 done");
    await expect(page.getByText("sample.jpg")).toHaveCount(3);
    await page.getByText("sample.jpg").first().click();
    await expectAutomaticCutout(page);
    const workspace = page.getByTestId("tool-workspace");
    const firstDocumentId = await workspace.getAttribute("data-document-id");
    expect(firstDocumentId).toBeTruthy();
    await page.getByRole("button", { name: /^Background$/ }).click();
    await page
      .getByRole("slider", { name: /before\/after comparison/i })
      .press("ArrowRight");
    await expect(
      page.getByRole("slider", { name: /before\/after comparison/i }),
    ).toHaveAttribute("aria-valuenow", "55");
    await expect(page.getByRole("toolbar", { name: /editor tools/i })).toBeVisible();
    const selectedTile = page
      .getByRole("button", {
        name: /select sample\.jpg for review/i,
      })
      .first();
    await expect(selectedTile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Upload an image")).toHaveCount(0);
    const addImages = page.getByLabel("Add images");
    await addImages.setInputFiles(SAMPLE_IMAGE);
    await expect(page.getByTestId("batch-item-thumbnail")).toHaveCount(4);
    await expect(selectedTile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Selected for review")).toHaveCount(1);
    await expect(page.getByRole("slider")).toBeVisible();
    const previewImages = page.getByRole("slider").locator("xpath=..//img");
    await expect(previewImages).toHaveCount(2);
    await expect
      .poll(async () =>
        previewImages
          .first()
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    const previewBox = await page.getByTestId("editor-stage").boundingBox();
    const controlsBox = await page.getByTestId("tool-panel-slot").boundingBox();
    const statusBox = await page.getByTestId("scheduler-summary").boundingBox();
    const listBox = await page.getByRole("heading", { name: "All images" }).boundingBox();
    expect(previewBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(listBox).not.toBeNull();
    if (previewBox && controlsBox && statusBox && listBox) {
      if ((page.viewportSize()?.width ?? 0) >= 1024) {
        expect(Math.abs(previewBox.y - controlsBox.y)).toBeLessThan(24);
      } else {
        expect(controlsBox.y).toBeGreaterThan(previewBox.y);
      }
      expect(statusBox.y).toBeLessThan(previewBox.y);
      expect(previewBox.y).toBeLessThan(listBox.y);
    }

    const actionBoxes = await Promise.all([
      page.getByLabel("Add images").locator("..").boundingBox(),
      page.getByRole("button", { name: /^download all$/i }).boundingBox(),
      page.getByRole("button", { name: /clear batch/i }).boundingBox(),
    ]);
    expect(actionBoxes.every(Boolean)).toBe(true);
    const [addBox, downloadAllBox, clearBox] = actionBoxes;
    if (addBox && downloadAllBox && clearBox) {
      expect(Math.abs(addBox.height - downloadAllBox.height)).toBeLessThan(2);
      expect(Math.abs(addBox.width - downloadAllBox.width)).toBeLessThan(2);
      expect(clearBox.y).toBeLessThan(addBox.y);
    }

    await page.getByRole("button", { name: /^Background$/ }).click();
    await page.getByRole("button", { name: "Ocean" }).click();
    await expect(page.getByRole("button", { name: /^download$/i })).toBeEnabled();
    await saveBackground(page);
    await expect(page.getByRole("button", { name: /^download$/i })).toBeEnabled();
    const itemButtons = page.getByRole("button", {
      name: /select sample\.jpg for review/i,
    });
    await itemButtons.nth(1).click();
    await expect(workspace).not.toHaveAttribute("data-document-id", firstDocumentId!);
    await expect(page.getByTestId("tool-panel-slot")).toHaveAttribute(
      "data-active-tool",
      "cutout",
    );
    await page.getByRole("button", { name: /^Background$/ }).click();
    await expect(
      page.getByRole("slider", { name: /before\/after comparison/i }),
    ).toHaveAttribute("aria-valuenow", "50");
    await expect(page.getByRole("button", { name: "Transparent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await itemButtons.first().click();
    await expect(workspace).toHaveAttribute("data-document-id", firstDocumentId!);
    await expect(
      page.getByRole("slider", { name: /before\/after comparison/i }),
    ).toHaveAttribute("aria-valuenow", "55");
    await expect(page.getByRole("button", { name: "Ocean" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const individual = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    expect((await individual).suggestedFilename()).toBe("result.png");

    await openManualCutout(page);
    await expect(
      page.getByRole("application", { name: /mask correction editor/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^cancel$/i }).click();

    await page.getByRole("radio", { name: /^Optimal/i }).click();
    await expect(page.getByRole("radio", { name: /^Optimal/i })).toBeChecked();
    await expect(
      page.getByRole("button", { name: /reprocess in Fast mode/i }),
    ).toBeVisible();
    await expect(page.getByText(/setting applies to images added after/i)).toBeVisible();

    const schedulerSummary = page.getByTestId("scheduler-summary");
    await page.getByRole("button", { name: /reprocess in Fast mode/i }).click();
    await expect(schedulerSummary).not.toContainText("4 done");
    await expect(schedulerSummary).toContainText("4 done");

    const archive = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download all$/i }).click();
    expect((await archive).suggestedFilename()).toBe("cutbg-results.zip");
  });

  test("split download exports exact PNG sizes and repeats the explicit command in its menu", async ({
    page,
  }) => {
    await page.goto("/en");
    const large = await createLargePng(page, "large.png");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(large);
    await expectAutomaticCutout(page);

    await page.getByRole("button", { name: "Output options" }).click();
    await expect(page.getByRole("menuitemradio", { name: "2048 px" })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: "1024 px" })).toBeVisible();
    await page.getByRole("menuitemradio", { name: "2048 px" }).click();
    await expect(page.getByText("Output size selected: 2048 px")).toBeAttached();
    const menuDownload = page.getByRole("menuitem", { name: "Download" });
    const resized2048 = await inspectDownloadedPng(page, menuDownload);
    expect(resized2048).toMatchObject({
      width: 2048,
      height: 1024,
      fileName: "result-2048.png",
    });

    await page.getByRole("button", { name: "Output options" }).click();
    await page.getByRole("menuitemradio", { name: "1024 px" }).click();
    await page.keyboard.press("Escape");
    const resized1024 = await inspectDownloadedPng(page);
    expect(resized1024).toMatchObject({
      width: 1024,
      height: 512,
      fileName: "result-1024.png",
    });
    expect(resized1024.corner).toEqual(resized2048.corner);
  });

  test("batch: gives immediate preparation feedback and identifiable interactive tiles", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const nativeCreateImageBitmap = window.createImageBitmap.bind(window);
      window.createImageBitmap = async (image: ImageBitmapSource) => {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        return nativeCreateImageBitmap(image);
      };
    });
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();

    await upload.setInputFiles([SAMPLE_IMAGE, SAMPLE_IMAGE, SAMPLE_IMAGE, SAMPLE_IMAGE]);

    await expect(page.getByTestId("upload-preparation")).toContainText(
      "Preparing 4 images",
    );
    await expect(upload).toBeDisabled();
    await expect(page.getByTestId("batch-item-thumbnail")).toHaveCount(4);
    await expect(page.getByText(/\d+ × \d+ · Fast/)).toHaveCount(4);
    const unavailableTile = page
      .getByRole("button", { name: /review available when ready/i })
      .first();
    await expect(unavailableTile).toBeDisabled();
    await expect(page.getByText(/#\d+ in queue/).first()).toBeVisible();
    await expect(page.getByTestId("item-stage-progress")).toBeVisible();

    await expect(page.getByText("Select to review")).toHaveCount(4);

    const firstTile = page
      .getByRole("button", {
        name: /select sample\.jpg for review/i,
      })
      .first();
    await firstTile.hover();
    await firstTile.click();
    await expect(firstTile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Selected for review")).toHaveCount(1);
  });
});
