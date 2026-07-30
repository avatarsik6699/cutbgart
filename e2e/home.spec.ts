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
    modes: [/^Fast/i, /^Optimal/i, /^Maximum/i],
    help: /About Maximum quality/i,
    helpBody: /precise model on WebGPU/i,
    cutout: /^Cutout$/,
    enhance: /^Enhancements$/,
    background: /^Background$/,
    close: /^Close$/,
  },
  {
    path: "/",
    modes: [/^Быстро/i, /^Оптимально/i, /^Максимум/i],
    help: /О максимальном качестве/i,
    helpBody: /самую точную модель на WebGPU/i,
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
    // Phase 30 replaced the raster logo `<img>` with an inline SVG mark
    // inside a header/footer `<Link aria-label="cutbg">` (`brand-logo.tsx`)
    // — assert the accessible link, not an `<img>` role that no longer
    // exists.
    const brandLinks = page.getByRole("link", { name: "cutbg", exact: false });
    await expect(brandLinks).toHaveCount(2);
    await expect(brandLinks.first()).toBeVisible();
    await expect(page.getByTestId("processing-mode-selector")).toBeVisible();
    await expect(page.getByLabel("Upload an image")).toBeAttached();
  });

  test("command deck highlights Maximum quality and keeps the engineering grid below the header", async ({
    page,
  }) => {
    await page.goto("/en");

    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      // Phase 30 replaced the "Recommended"/"Beta" text badges with a
      // shimmer border on the Maximum-quality card (see
      // `QualityModeToggle.test.tsx` — "shows no Beta or Recommended
      // badges"). Assert that highlight instead of stale badge text.
      const maximumRadio = page.getByRole("radio", { name: /Maximum/ });
      const maximumCard = maximumRadio.locator(
        'xpath=ancestor::*[contains(@class,"group") and contains(@class,"relative")][1]',
      );
      await expect(maximumCard).toHaveClass(/quality-mode-shimmer/);
      await expect(page.getByText("Recommended", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Beta", { exact: true })).toHaveCount(0);

      const header = page.locator('[data-slot="site-header"]');
      const pattern = page.locator(".site-background-pattern");
      const [headerBox, patternBox, headerBackground] = await Promise.all([
        header.boundingBox(),
        pattern.boundingBox(),
        header.evaluate((node) => getComputedStyle(node).backgroundImage),
      ]);
      expect(headerBox).not.toBeNull();
      expect(patternBox).not.toBeNull();
      if (headerBox && patternBox)
        expect(patternBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
      expect(headerBackground).toBe("none");
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth === document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  });

  test("idle workspace uses the approved stacked/5–7 composition", async ({ page }) => {
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
    expect(desktopColumns).toBe(2);
    const introBox = await page.getByTestId("home-empty-intro").boundingBox();
    const uploadBox = await page
      .getByLabel("Upload an image")
      .locator("xpath=ancestor::section[1]")
      .boundingBox();
    expect(introBox).not.toBeNull();
    expect(uploadBox).not.toBeNull();
    if (introBox && uploadBox) {
      expect(introBox.x).toBeLessThan(uploadBox.x);
      expect(uploadBox.width).toBeGreaterThan(introBox.width);
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

  test("keeps the upload surface in place on an invalid file, with a working retry (PHASE_31 T8/F7)", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByLabel("Upload an image")).toBeEnabled();

    await page.getByLabel("Upload an image").setInputFiles(UNSUPPORTED_FILE);
    await expect(page.getByRole("alert")).toContainText(/unsupported file format/i);

    // The upload dropzone and quality-mode controls stay mounted next to the
    // error instead of disappearing/being replaced — no layout shift, and
    // the user can immediately pick another file without extra navigation.
    // (The dropzone input itself is responsively hidden below `sm` in favor
    // of `ChoosePhotoButton` — that's pre-existing, viewport-driven behavior
    // unrelated to this fix, so assert DOM presence here, not visibility.)
    await expect(page.getByLabel("Upload an image")).toBeAttached();
    await expect(page.getByRole("radio").first()).toBeVisible();

    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByLabel("Upload an image")).toBeEnabled();

    await page.getByLabel("Upload an image").setInputFiles(SAMPLE_IMAGE);
    await expectAutomaticCutout(page);
  });

  test("critical path hides marketing and returns through the compact back action", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByTestId("home-empty-intro")).toBeVisible();
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);

    await expect(page.getByTestId("home-empty-intro")).toHaveCount(0);
    await expect(page.getByTestId("workspace-topbar")).toHaveCount(0);
    await expect(page.getByTestId("editor-toolbar")).toBeVisible();
    await expectAutomaticCutout(page);
    await expect(
      page.getByTestId("editor-toolbar").getByRole("button").first(),
    ).toHaveAttribute("aria-label", "Back to upload");
    await expect(page.getByRole("button", { name: /^download$/i })).toBeVisible();

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

    await page.getByRole("button", { name: /back to upload/i }).click();
    // `toBeAttached`, not `toBeVisible`: UploadDropzone (this locator) is
    // `hidden sm:flex` — ChoosePhotoButton is the visible control on narrow
    // viewports (e.g. the Mobile Safari project). Matches the same pattern
    // used for this locator in the idle-state test above.
    await expect(page.getByLabel("Upload an image")).toBeAttached();
    await expect(page.getByTestId("home-empty-intro")).toBeVisible();
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  test("diagnostics stays closed by default and opens over the editor layout", async ({
    page,
  }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);
    await expectAutomaticCutout(page);

    await expect(page.getByTestId("processing-details")).toHaveCount(0);
    await expect(
      page.locator(
        '[data-slot="site-header"] [data-testid^="diagnostics-trigger-"]:visible',
      ),
    ).toHaveCount(1);
    const stage = page.getByTestId("editor-stage");
    const stageBox = await stage.boundingBox();
    await page.locator('[data-testid^="diagnostics-trigger-"]:visible').click();
    await expect(page.getByTestId("processing-details")).toBeVisible();
    await expect(stage).toBeVisible();
    expect(await stage.boundingBox()).toEqual(stageBox);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("processing-details")).toHaveCount(0);
  });

  test("tool switches keep the same stage, comparison DOM, and blob URLs", async ({
    page,
  }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);
    await expectAutomaticCutout(page);

    const stage = page.getByTestId("editor-stage");
    const stack = page.getByTestId("persistent-preview-stack");
    const comparison = page.getByTestId("before-after-frame");
    await stage.evaluate((node) => {
      node.dataset.persistenceMarker = "stage";
    });
    await stack.evaluate((node) => {
      node.dataset.persistenceMarker = "stack";
    });
    await comparison.evaluate((node) => {
      node.dataset.persistenceMarker = "comparison";
    });
    const imageSources = await comparison
      .locator("img")
      .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));

    await page.getByRole("button", { name: /^Enhancements$/ }).click();
    await expect(page.getByTestId("editor-stage")).toHaveAttribute(
      "data-persistence-marker",
      "stage",
    );
    await expect(page.getByTestId("persistent-preview-stack")).toHaveAttribute(
      "data-persistence-marker",
      "stack",
    );
    await expect(page.getByTestId("before-after-frame")).toHaveAttribute(
      "data-persistence-marker",
      "comparison",
    );
    expect(
      await page
        .getByTestId("before-after-frame")
        .locator("img")
        .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src)),
    ).toEqual(imageSources);

    await page.getByRole("button", { name: /^Background$/ }).click();
    await expect(page.getByTestId("before-after-frame")).toHaveAttribute(
      "data-persistence-marker",
      "comparison",
    );
    await expect(page.getByTestId("after-preview-background")).toBeVisible();
  });

  test("portrait, landscape, and square sources use contain-fit stage geometry", async ({
    page,
  }) => {
    await page.goto("/en");
    const fixtures = [
      await createLargePng(page, "portrait.png", 400, 800),
      await createLargePng(page, "landscape.png", 800, 400),
      await createLargePng(page, "square.png", 600, 600),
    ];

    for (const fixture of fixtures) {
      const upload = page.getByLabel("Upload an image");
      await expect(upload).toBeEnabled();
      await upload.setInputFiles(fixture);
      await expectAutomaticCutout(page);
      const frame = page.getByTestId("guided-brush-edit-frame");
      await expect(frame).toHaveAttribute("data-fit", "contain");
      const dimensions = await frame.evaluate((node) => ({
        rendered:
          node.getBoundingClientRect().width / node.getBoundingClientRect().height,
        source:
          Number(node.getAttribute("data-source-width")) /
          Number(node.getAttribute("data-source-height")),
      }));
      expect(Math.abs(dimensions.rendered - dimensions.source)).toBeLessThan(0.02);
      const frameBox = await frame.boundingBox();
      const stageBox = await page.getByTestId("editor-stage").boundingBox();
      expect(frameBox).not.toBeNull();
      expect(stageBox).not.toBeNull();
      if (frameBox && stageBox) {
        expect(frameBox.width).toBeLessThanOrEqual(stageBox.width);
        expect(frameBox.height).toBeLessThanOrEqual(stageBox.height);
      }
      await page.getByRole("button", { name: /back to upload/i }).click();
      await expect(page.getByLabel("Upload an image")).toBeAttached();
    }
  });

  test("single and batch editor controls stay inside the page at review breakpoints", async ({
    page,
  }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(Array.from({ length: 12 }, () => SAMPLE_IMAGE));
    await expect(page.getByTestId("scheduler-summary")).toContainText("12 done", {
      timeout: 20_000,
    });
    await page
      .getByRole("button", { name: /select sample\.jpg for review/i })
      .first()
      .click();
    await expectAutomaticCutout(page);
    await page.getByRole("button", { name: /^Background$/ }).click();

    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            content: document.documentElement.scrollWidth,
          })),
        )
        .toEqual({ viewport: width, content: width });

      const direction = await page
        .getByTestId("batch-filmstrip")
        .evaluate((node) => getComputedStyle(node).flexDirection);
      expect(direction).toBe("row");
      const filmstripScroll = await page
        .getByTestId("batch-filmstrip")
        .evaluate((node) => {
          const element = node as HTMLElement;
          element.scrollLeft = 80;
          return {
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            scrollLeft: element.scrollLeft,
          };
        });
      expect(filmstripScroll.scrollWidth).toBeGreaterThan(filmstripScroll.clientWidth);
      expect(filmstripScroll.scrollLeft).toBeGreaterThan(0);

      for (const testId of ["editor-toolbar", "editor-stage", "tool-panel-slot"]) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(-1);
          expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        }
      }

      const filmstripBox = await page.getByTestId("batch-filmstrip").boundingBox();
      const toolbarBox = await page.getByTestId("editor-toolbar").boundingBox();
      expect(filmstripBox).not.toBeNull();
      expect(toolbarBox).not.toBeNull();
      if (filmstripBox && toolbarBox)
        expect(filmstripBox.y + filmstripBox.height).toBeLessThan(toolbarBox.y);
    }
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
    test.setTimeout(60_000);
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
    const filmstripBox = await page.getByTestId("batch-filmstrip").boundingBox();
    expect(previewBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(filmstripBox).not.toBeNull();
    if (previewBox && controlsBox && statusBox && filmstripBox) {
      if ((page.viewportSize()?.width ?? 0) >= 896) {
        expect(Math.abs(previewBox.y - controlsBox.y)).toBeLessThan(24);
      } else {
        expect(controlsBox.y).toBeGreaterThan(previewBox.y);
      }
      expect(filmstripBox.y).toBeLessThan(previewBox.y);
      expect(statusBox.y).toBeLessThan(previewBox.y);
    }

    const actionBoxes = await Promise.all([
      page.getByLabel("Add images").locator("..").boundingBox(),
      page.getByRole("button", { name: /^download$/i }).boundingBox(),
      page.getByRole("button", { name: /back to upload/i }).boundingBox(),
    ]);
    expect(actionBoxes.every(Boolean)).toBe(true);
    const [addBox, downloadBox, backBox] = actionBoxes;
    if (addBox && downloadBox && backBox) {
      expect(Math.abs(addBox.height - downloadBox.height)).toBeLessThan(10);
      expect(backBox.x).toBeLessThan(addBox.x);
      expect(backBox.x).toBeLessThan(downloadBox.x);
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

    const selectedItemActions = selectedTile
      .locator("xpath=..")
      .getByTestId("batch-item-actions");
    await selectedItemActions.click();
    const itemDownload = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /download png/i }).click();
    expect((await itemDownload).suggestedFilename()).toBe("cutbg-result-1.png");

    await openManualCutout(page);
    await expect(
      page.getByRole("application", { name: /mask correction editor/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^cancel$/i }).click();

    await page
      .getByTestId("editor-toolbar")
      .getByRole("button", { name: /^Fast$/i })
      .click();
    await page.getByRole("radio", { name: /^Optimal/i }).click();
    await expect(page.getByRole("radio", { name: /^Optimal/i })).toBeChecked();
    await page.getByTestId("batch-item-actions").first().click();
    await expect(
      page.getByRole("menuitem", { name: /reprocess in Fast mode/i }),
    ).toBeVisible();

    const schedulerSummary = page.getByTestId("scheduler-summary");
    await page.getByRole("menuitem", { name: /reprocess in Fast mode/i }).click();
    await expect(schedulerSummary).not.toContainText("4 done");
    await expect(schedulerSummary).toContainText("4 done");

    const archive = page.waitForEvent("download");
    await page.getByRole("button", { name: "Output options" }).click();
    await page.getByRole("menuitem", { name: /download all.*zip/i }).click();
    expect((await archive).suggestedFilename()).toBe("cutbg-results.zip");

    const manualCanvas = await openManualCutout(page);
    await page
      .getByTestId("cutout-tool-panel")
      .getByRole("button", { name: "Erase", exact: true })
      .click();
    const manualBox = await manualCanvas.boundingBox();
    if (!manualBox) throw new Error("Manual canvas has no bounding box");
    await manualCanvas.click({
      position: { x: manualBox.width / 2, y: manualBox.height / 2 },
    });

    await selectedItemActions.click();
    await page.getByRole("menuitem", { name: /^Remove image$/ }).click();
    await expect(page.getByTestId("editor-draft-guard")).toBeVisible();
    await page.getByRole("button", { name: "Continue editing" }).click();
    await expect(page.getByTestId("batch-item-thumbnail")).toHaveCount(4);

    await selectedItemActions.click();
    await page.getByRole("menuitem", { name: /^Remove image$/ }).click();
    await page.getByRole("button", { name: "Discard draft" }).click();
    await expect(page.getByTestId("batch-item-thumbnail")).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: /select sample\.jpg for review/i }).first(),
    ).toHaveAttribute("aria-pressed", "true");
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
    await expect(page.getByTestId("batch-filmstrip")).toBeVisible();
    await expect(page.getByTestId("batch-item-skeleton").first()).toBeVisible();
    await expect(page.getByText("sample.jpg")).toHaveCount(4);
    const unavailableTile = page
      .getByRole("button", { name: /review available when ready/i })
      .first();
    await expect(unavailableTile).toBeDisabled();
    await expect(page.getByText(/#\d+ in queue/).first()).toBeVisible();

    const firstTile = page
      .getByRole("button", {
        name: /select sample\.jpg for review/i,
      })
      .first();
    await expect(page.getByTestId("batch-item-thumbnail")).toHaveCount(4);
    await firstTile.hover();
    await firstTile.click();
    await expect(firstTile).toHaveAttribute("aria-pressed", "true");
  });
});
