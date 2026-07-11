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
});
