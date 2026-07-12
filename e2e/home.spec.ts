import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");
const UNSUPPORTED_FILE = path.join(__dirname, "fixtures", "unsupported.txt");

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

    await expect(page.getByRole("slider")).toBeVisible();
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

    const individual = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    expect((await individual).suggestedFilename()).toBe("result.png");

    await page.getByRole("button", { name: /edit mask/i }).click();
    await expect(
      page.getByRole("application", { name: /mask correction editor/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^done$/i }).click();
    await expect(page.getByRole("slider")).toBeVisible();

    await page.getByRole("switch").click();
    await expect(page.getByRole("switch")).toBeChecked();
    await expect(
      page.getByRole("button", { name: /reprocess in fast mode/i }),
    ).toBeVisible();
    await expect(page.getByText(/toggle applies to images added after/i)).toBeVisible();

    await page.getByRole("button", { name: /reprocess in fast mode/i }).click();
    await expect(page.getByTestId("scheduler-summary")).toContainText("3 done");

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
