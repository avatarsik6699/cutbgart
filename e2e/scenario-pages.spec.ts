import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");

async function waitForHeaderHydration(page: import("@playwright/test").Page) {
  await expect(page.locator('[data-slot="site-header"]')).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

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
  // English counterparts (Phase 12 F11/F12) — distinct translated slugs, not
  // just an /en/ prefix of the ru slug, so each is exercised independently.
  {
    path: "/en/remove-background-from-product-photo",
    testId: "product-photo-page",
    h1: /remove the background from a product photo/i,
  },
  {
    path: "/en/remove-background-from-id-photo",
    testId: "document-photo-page",
    h1: /remove the background from an id photo/i,
  },
  {
    path: "/en/remove-background-from-logo",
    testId: "logo-page",
    h1: /remove the background from a logo/i,
  },
  {
    path: "/en/remove-background-from-avatar",
    testId: "avatar-page",
    h1: /remove the background from an avatar/i,
  },
];

interface ScenarioExample {
  path: string;
  src: string;
  width: number;
  height: number;
}

const SCENARIO_EXAMPLES: ScenarioExample[] = [
  {
    path: "/udalit-fon-s-foto-tovara",
    src: "/images/product-photo-example.webp",
    width: 1254,
    height: 1254,
  },
  {
    path: "/en/remove-background-from-product-photo",
    src: "/images/product-photo-example.webp",
    width: 1254,
    height: 1254,
  },
  {
    path: "/udalit-fon-s-foto-na-dokumenty",
    src: "/images/document-photo-example.webp",
    width: 1086,
    height: 1448,
  },
  {
    path: "/en/remove-background-from-id-photo",
    src: "/images/document-photo-example.webp",
    width: 1086,
    height: 1448,
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
      await expect(page.getByTestId("processing-mode-selector")).toBeVisible();
      await expect(
        page.getByLabel(/Upload an image|Загрузить изображения/),
      ).toBeAttached();
    });

    test("the upload -> process path stays reachable through the reused features", async ({
      page,
    }) => {
      await page.goto(scenario.path);

      const uploadInput = page.getByLabel(/Upload an image|Загрузить изображения/);
      // Phase 08 hydration guard: the SSR-visible upload input stays disabled
      // until React handlers attach, so the first real upload cannot be
      // silently dropped before hydration.
      await expect(uploadInput).toBeEnabled();
      await uploadInput.setInputFiles(SAMPLE_IMAGE);

      // A rendered result proves the scenario composition reached the Worker
      // boundary and completed the shared upload/process path.
      await expect(page.getByRole("slider")).toBeVisible();
      await expect(page.getByRole("group", { name: /Background|Фон/ })).toBeVisible();
    });
  });
}

for (const example of SCENARIO_EXAMPLES) {
  test(`${example.path} preserves the example image dimensions and responsive cap`, async ({
    page,
  }) => {
    await page.goto(example.path);

    const image = page.locator(`img[src="${example.src}"]`);
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("width", String(example.width));
    await expect(image).toHaveAttribute("height", String(example.height));

    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => ({
          width: element.naturalWidth,
          height: element.naturalHeight,
        })),
      )
      .toEqual({ width: example.width, height: example.height });

    const rendered = await image.boundingBox();
    expect(rendered).not.toBeNull();
    expect(rendered!.width).toBeLessThanOrEqual(640);
    expect(rendered!.width / rendered!.height).toBeCloseTo(
      example.width / example.height,
      2,
    );
  });
}

test.describe("/udalit-fon-s-foto-tovara (deep critical path)", () => {
  test("critical path: upload -> process -> download, on a scenario page", async ({
    page,
  }) => {
    await page.goto("/udalit-fon-s-foto-tovara");
    const upload = page.getByLabel("Загрузить изображения");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE_IMAGE);

    await expect(page.getByRole("slider")).toBeVisible();
    await expect(page.getByRole("button", { name: /скачать/i })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^скачать$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("result.png");
  });

  test("the reused upload surface enters batch mode for multiple files", async ({
    page,
  }) => {
    await page.goto("/udalit-fon-s-foto-tovara");
    const upload = page.getByLabel("Загрузить изображения");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles([SAMPLE_IMAGE, SAMPLE_IMAGE]);
    await expect(page.getByTestId("scheduler-summary")).toContainText("готово 2");
    await expect(page.getByRole("button", { name: /^скачать всё$/i })).toBeEnabled();
  });
});

test.describe("/about", () => {
  test("renders static project info without the upload tool", async ({ page }) => {
    await page.goto("/about");

    await expect(page.getByTestId("about-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /о проекте cutbg/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/Upload an image|Загрузить изображения/)).toHaveCount(0);
  });
});

test.describe("/en/about", () => {
  test("renders the English counterpart without the upload tool", async ({ page }) => {
    await page.goto("/en/about");

    await expect(page.getByTestId("about-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /about cutbg/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/Upload an image|Загрузить изображения/)).toHaveCount(0);
  });
});

test.describe("language switcher (Phase 12)", () => {
  test("preserves the current page when toggling locale", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.getByRole("heading", { level: 1, name: /о проекте cutbg/i }),
    ).toBeVisible();
    await waitForHeaderHydration(page);

    await page.getByRole("link", { name: /^english$/i }).click();
    await expect(page).toHaveURL(/\/en\/about\/?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /about cutbg/i }),
    ).toBeVisible();
    await waitForHeaderHydration(page);

    await page.getByRole("link", { name: /русский/i }).click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /о проекте cutbg/i }),
    ).toBeVisible();
  });

  test("translates the slug (not just the /en/ prefix) on a scenario page", async ({
    page,
  }) => {
    await page.goto("/udalit-fon-s-foto-tovara");
    await expect(
      page.getByRole("heading", { level: 1, name: /удалить фон с фото товара/i }),
    ).toBeVisible();
    await waitForHeaderHydration(page);

    await page.getByRole("link", { name: /^english$/i }).click();
    await expect(page).toHaveURL(/\/en\/remove-background-from-product-photo\/?$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /remove the background from a product photo/i,
      }),
    ).toBeVisible();
    await waitForHeaderHydration(page);

    await page.getByRole("link", { name: /русский/i }).click();
    await expect(page).toHaveURL(/\/udalit-fon-s-foto-tovara\/?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /удалить фон с фото товара/i }),
    ).toBeVisible();
  });
});
