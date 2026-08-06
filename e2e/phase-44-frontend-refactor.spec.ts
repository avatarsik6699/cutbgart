import { expect, test } from "./support/v2/fixtures";

test.describe.configure({ mode: "serial", retries: 0 });

type ShellRoute = Readonly<{
  diagnosticsEmpty: string;
  hasModelStorage: boolean;
  pageTestId?: string;
  path: string;
  uploadLabel: string;
}>;

const shellRoutes: readonly ShellRoute[] = [
  {
    diagnosticsEmpty: "Диагностических данных пока нет",
    hasModelStorage: true,
    path: "/",
    uploadLabel: "Загрузить изображения",
  },
  {
    diagnosticsEmpty: "Диагностических данных пока нет",
    hasModelStorage: false,
    path: "/udalit-fon-dlya-avatarki",
    pageTestId: "avatar-page",
    uploadLabel: "Загрузить изображения",
  },
  {
    diagnosticsEmpty: "No diagnostic data yet",
    hasModelStorage: false,
    path: "/en/remove-background-from-id-photo",
    pageTestId: "document-photo-page",
    uploadLabel: "Upload an image",
  },
];

test("public and localized scenario routes share the shell without losing the editor", async ({
  page,
}) => {
  for (const route of shellRoutes) {
    await page.goto(route.path);

    await expect(page.locator('[data-slot="site-header"]')).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await expect(page.locator('[data-slot="site-footer"]')).toBeVisible();
    await expect(page.getByLabel(route.uploadLabel)).toBeEnabled();
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByTestId("diagnostics-trigger-desktop")).toHaveCount(1);
    await expect(page.getByTestId("diagnostics-trigger-mobile")).toHaveCount(1);
    await expect(page.getByTestId("model-storage-trigger")).toHaveCount(
      route.hasModelStorage ? 1 : 0,
    );
    if (route.hasModelStorage) {
      await page.getByTestId("model-storage-trigger").click();
      await expect(page.getByTestId("model-storage-manager")).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await page.getByTestId("diagnostics-trigger-desktop").click();
    await expect(page.getByTestId("processing-details")).toBeVisible();
    await expect(page.getByText(route.diagnosticsEmpty)).toBeVisible();
    await page.keyboard.press("Escape");
    if (route.pageTestId !== undefined)
      await expect(page.getByTestId(route.pageTestId)).toBeVisible();
  }
});
