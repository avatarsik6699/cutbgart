import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");

test("real model smoke: upload -> inference -> result", async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  await page.goto("/");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE_IMAGE);
  await expect(page.getByText(/loading .* model…/i)).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible({ timeout: 4 * 60 * 1000 });
  await expect(page.getByRole("button", { name: /^download$/i })).toBeVisible();
});
