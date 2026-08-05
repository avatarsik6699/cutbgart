import type { Page } from "@playwright/test";

import { expect, test } from "./support/v2/fixtures";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

type PublicRoute = Readonly<{
  path: string;
  canonicalPath: string;
  locale: "ru" | "en";
  pageTestId?: string;
  heading?: RegExp;
}>;

const publicRoutes: readonly PublicRoute[] = [
  { path: "/", canonicalPath: "/", locale: "ru" },
  { path: "/en", canonicalPath: "/", locale: "en" },
  {
    path: "/udalit-fon-dlya-avatarki",
    canonicalPath: "/udalit-fon-dlya-avatarki",
    locale: "ru",
    pageTestId: "avatar-page",
    heading: /удалить фон для аватарки/i,
  },
  {
    path: "/udalit-fon-s-foto-na-dokumenty",
    canonicalPath: "/udalit-fon-s-foto-na-dokumenty",
    locale: "ru",
    pageTestId: "document-photo-page",
    heading: /удалить фон с фото на документы/i,
  },
  {
    path: "/udalit-fon-s-foto-tovara",
    canonicalPath: "/udalit-fon-s-foto-tovara",
    locale: "ru",
    pageTestId: "product-photo-page",
    heading: /удалить фон с фото товара/i,
  },
  {
    path: "/udalit-fon-s-logotipa",
    canonicalPath: "/udalit-fon-s-logotipa",
    locale: "ru",
    pageTestId: "logo-page",
    heading: /удалить фон с логотипа/i,
  },
  {
    path: "/en/remove-background-from-avatar",
    canonicalPath: "/udalit-fon-dlya-avatarki",
    locale: "en",
    pageTestId: "avatar-page",
    heading: /remove the background from an avatar/i,
  },
  {
    path: "/en/remove-background-from-id-photo",
    canonicalPath: "/udalit-fon-s-foto-na-dokumenty",
    locale: "en",
    pageTestId: "document-photo-page",
    heading: /remove the background from an id photo/i,
  },
  {
    path: "/en/remove-background-from-product-photo",
    canonicalPath: "/udalit-fon-s-foto-tovara",
    locale: "en",
    pageTestId: "product-photo-page",
    heading: /remove the background from a product photo/i,
  },
  {
    path: "/en/remove-background-from-logo",
    canonicalPath: "/udalit-fon-s-logotipa",
    locale: "en",
    pageTestId: "logo-page",
    heading: /remove the background from a logo/i,
  },
];

function uploadLabel(locale: PublicRoute["locale"]): string {
  return locale === "en" ? "Upload an image" : "Загрузить изображения";
}

async function expectV2Workspace(page: Page, route: PublicRoute): Promise<void> {
  await expect(page.getByLabel(uploadLabel(route.locale))).toBeEnabled();
  if (route.pageTestId !== undefined)
    await expect(page.getByTestId(route.pageTestId)).toBeVisible();
  if (route.heading !== undefined)
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }),
    ).toBeVisible();
}

test("all public and scenario routes compose the hydrated v2 workspace", async ({
  page,
}) => {
  for (const route of publicRoutes) {
    await page.goto(route.path);
    await expectV2Workspace(page, route);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${route.canonicalPath === "/" ? "/?$" : `${route.canonicalPath}/?$`}`),
    );
  }
});

test("root and scenario uploads cross the v2 worker boundary in both locales", async ({
  editorV2,
  page,
}) => {
  const routes: readonly PublicRoute[] = [
    publicRoutes[0]!,
    publicRoutes[1]!,
    publicRoutes[2]!,
    publicRoutes[6]!,
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expectV2Workspace(page, route);
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
    await page
      .getByLabel(uploadLabel(route.locale))
      .setInputFiles(phase33ImageCorpus.smoke.path);
    await expect.poll(editorV2.scenario.runCount).toBe(1);
    await editorV2.scenario.completeRun();
    await expect(page.getByRole("slider")).toBeVisible();
  }
});

test("migration routes redirect by locale and the legacy harness is gone", async ({
  page,
  request,
}) => {
  const russianRedirect = await request.get("/editor-v2", { maxRedirects: 0 });
  expect(russianRedirect.status()).toBe(308);
  expect(russianRedirect.headers().location).toBe("/");

  const englishRedirect = await request.get("/en/editor-v2", { maxRedirects: 0 });
  expect(englishRedirect.status()).toBe(308);
  expect(englishRedirect.headers().location).toBe("/en/");

  await page.goto("/dev/remove-background");
  await expect(page.getByTestId("not-found-page")).toBeVisible();
  await expect(page.getByTestId("remove-background-test-harness")).toHaveCount(0);
});
