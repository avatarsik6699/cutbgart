import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");
const UNSUPPORTED_FILE = path.join(__dirname, "fixtures", "unsupported.txt");

async function saveBackground(page: import("@playwright/test").Page) {
  const saveButton = page.getByRole("button", { name: /^save background$/i });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(saveButton).toBeDisabled();
}

async function downloadedCorner(page: import("@playwright/test").Page) {
  await expect(page.getByRole("button", { name: /^download$/i })).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /^download$/i }).click();
  const downloadPath = await (await pending).path();
  if (!downloadPath) throw new Error("Downloaded PNG path is unavailable");
  const bytes = Array.from(await readFile(downloadPath));
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(data)], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, bytes);
}

test.describe("/ (home)", () => {
  test.beforeEach(async ({ page }) => {
    await installMockInference(page);
  });
  test("renders the idle state with the quality toggle and upload controls", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("home-page")).toBeVisible();
    await expect(page.getByRole("switch")).toBeVisible();
    await expect(page.getByLabel("Upload an image")).toBeAttached();
  });

  test("shows a clear error for an unsupported file format without starting the model pipeline", async ({
    page,
  }) => {
    await page.goto("/");
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
    await page.goto("/");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);

    await expect(
      page.getByRole("slider", { name: /before\/after comparison/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /download/i })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("result.png");

    await page.getByRole("button", { name: /process another image/i }).click();
    // `toBeAttached`, not `toBeVisible`: UploadDropzone (this locator) is
    // `hidden sm:flex` — ChoosePhotoButton is the visible control on narrow
    // viewports (e.g. the Mobile Safari project). Matches the same pattern
    // used for this locator in the idle-state test above.
    await expect(page.getByLabel("Upload an image")).toBeAttached();
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  test("background replacement updates preview and downloaded PNG for color, gradient, and uploaded image", async ({
    page,
  }) => {
    await page.goto("/");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);
    await expect(page.getByRole("slider")).toBeVisible();
    const preview = page.getByTestId("after-preview-background");
    await expect(page.getByTestId("fill-swatch")).toHaveCount(8);

    await page.getByRole("button", { name: "Background color" }).click();
    const palette = page.getByRole("slider", {
      name: "Color saturation and brightness",
    });
    const hue = page.getByRole("slider", { name: "Color hue" });
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
    await expect(page.getByRole("button", { name: /^download$/i })).toBeDisabled();
    await saveBackground(page);
    const colorPixel = await downloadedCorner(page);
    expect(colorPixel[0]).toBeGreaterThan(240);
    // The deterministic matte keeps a small amount of the source pixel at the
    // corner, so assert a strongly red composite rather than an exact fill.
    expect(colorPixel[1]).toBeLessThan(80);
    expect(colorPixel[2]).toBeLessThan(80);
    expect(colorPixel[3]).toBe(255);

    await page.getByRole("button", { name: /edit mask/i }).click();
    const correctionCanvas = page.getByRole("img", {
      name: /mask correction canvas/i,
    });
    await expect(correctionCanvas).toHaveCSS("background-color", /rgb\(25\d, \d+, \d+\)/);
    await page.getByRole("button", { name: /^done$/i }).click();
    await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible();

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
    await page.goto("/");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles([SAMPLE_IMAGE, SAMPLE_IMAGE, SAMPLE_IMAGE]);

    await expect(page.getByTestId("scheduler-summary")).toContainText("3 done");
    await expect(page.getByText("sample.jpg")).toHaveCount(3);
    await page.getByText("sample.jpg").first().click();
    await expect(page.getByRole("slider")).toBeVisible();

    await page.getByRole("button", { name: "Ocean" }).click();
    await expect(page.getByRole("button", { name: /^download$/i })).toBeDisabled();
    await saveBackground(page);
    await expect(page.getByRole("button", { name: /^download$/i })).toBeEnabled();
    const itemButtons = page.getByRole("button", {
      name: /select sample\.jpg for review/i,
    });
    await itemButtons.nth(1).click();
    await expect(page.getByRole("button", { name: "Transparent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await itemButtons.first().click();
    await expect(page.getByRole("button", { name: "Ocean" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const individual = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    expect((await individual).suggestedFilename()).toBe("result.png");

    await page.getByRole("button", { name: /edit mask/i }).click();
    await expect(
      page.getByRole("application", { name: /mask correction editor/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^done$/i }).click();
    await expect(
      page.getByRole("slider", { name: /before\/after comparison/i }),
    ).toBeVisible();

    await page.getByRole("switch").click();
    await expect(page.getByRole("switch")).toBeChecked();
    await expect(
      page.getByRole("button", { name: /reprocess in fast mode/i }),
    ).toBeVisible();
    await expect(page.getByText(/toggle applies to images added after/i)).toBeVisible();

    const schedulerSummary = page.getByTestId("scheduler-summary");
    await page.getByRole("button", { name: /reprocess in fast mode/i }).click();
    await expect(schedulerSummary).not.toContainText("3 done");
    await expect(schedulerSummary).toContainText("3 done");

    const archive = page.waitForEvent("download");
    await page.getByRole("button", { name: /download all as zip/i }).click();
    expect((await archive).suggestedFilename()).toBe("cutbg-results.zip");
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
    await page.goto("/");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();

    await upload.setInputFiles([SAMPLE_IMAGE, SAMPLE_IMAGE, SAMPLE_IMAGE, SAMPLE_IMAGE]);

    await expect(page.getByTestId("upload-preparation")).toContainText(
      "Preparing 4 images",
    );
    await expect(upload).toBeDisabled();
    await expect(page.getByTestId("batch-item-thumbnail")).toHaveCount(4);
    await expect(page.getByText(/\d+ × \d+ · Fast/)).toHaveCount(4);
    await expect(page.getByTestId("batch-queue-explanation")).toContainText(
      /processed in upload order/i,
    );

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
