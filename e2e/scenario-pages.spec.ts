import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");

interface ScenarioPage {
  path: string;
  testId: string;
  h1: RegExp;
}

const SCENARIO_PAGES: ScenarioPage[] = [
  {
    path: "/udalit-fon-s-foto-tovara",
    testId: "product-photo-page",
    h1: /удалить фон с фото товара/i,
  },
  {
    path: "/udalit-fon-s-foto-na-dokumenty",
    testId: "document-photo-page",
    h1: /удалить фон с фото на документы/i,
  },
  {
    path: "/udalit-fon-s-logotipa",
    testId: "logo-page",
    h1: /удалить фон с логотипа/i,
  },
  {
    path: "/udalit-fon-dlya-avatarki",
    testId: "avatar-page",
    h1: /удалить фон для аватарки/i,
  },
];

test.beforeEach(async ({ page }) => {
  await installMockInference(page);
});

for (const scenario of SCENARIO_PAGES) {
  test.describe(`${scenario.path} (scenario page)`, () => {
    test("renders its h1 and the upload control", async ({ page }) => {
      await page.goto(scenario.path);

      await expect(page.getByTestId(scenario.testId)).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 1, name: scenario.h1 }),
      ).toBeVisible();
      await expect(page.getByRole("switch")).toBeVisible();
      await expect(page.getByLabel("Upload an image")).toBeAttached();
    });

    test("the upload -> process path stays reachable through the reused features", async ({
      page,
    }) => {
      await page.goto(scenario.path);

      const uploadInput = page.getByLabel("Upload an image");
      // Phase 08 hydration guard: the SSR-visible upload input stays disabled
      // until React handlers attach, so the first real upload cannot be
      // silently dropped before hydration.
      await expect(uploadInput).toBeEnabled();
      await uploadInput.setInputFiles(SAMPLE_IMAGE);

      // A rendered result proves the scenario composition reached the Worker
      // boundary and completed the shared upload/process path.
      await expect(page.getByRole("slider")).toBeVisible();
    });
  });
}

test.describe("/udalit-fon-s-foto-tovara (deep critical path)", () => {
  test("critical path: upload -> process -> download, on a scenario page", async ({
    page,
  }) => {
    await page.goto("/udalit-fon-s-foto-tovara");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);

    await expect(page.getByRole("slider")).toBeVisible();
    await expect(page.getByRole("button", { name: /download/i })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("result.png");
  });
});

test.describe("/about", () => {
  test("renders static project info without the upload tool", async ({ page }) => {
    await page.goto("/about");

    await expect(page.getByTestId("about-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /about bg remove app/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Upload an image")).toHaveCount(0);
  });
});
