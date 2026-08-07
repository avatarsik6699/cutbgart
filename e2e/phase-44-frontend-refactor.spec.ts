import { expect, test } from "./support/editor/fixtures";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });

type ShellRoute = Readonly<{
  diagnosticsEmpty: string;
  fastModeLabel: string;
  hasModelStorage: boolean;
  helpBody: string;
  helpLabel: string;
  optimalModeLabel: string;
  pageTestId?: string;
  path: string;
  pasteHint: string;
  uploadLabel: string;
}>;

const shellRoutes: readonly ShellRoute[] = [
  {
    diagnosticsEmpty: "Диагностических данных пока нет",
    fastModeLabel: "Быстро",
    hasModelStorage: true,
    helpBody: "Использует самую точную модель на WebGPU",
    helpLabel: "О максимальном качестве",
    optimalModeLabel: "Оптимально",
    path: "/",
    pasteHint: "Вставить из буфера обмена",
    uploadLabel: "Загрузить изображения",
  },
  {
    diagnosticsEmpty: "Диагностических данных пока нет",
    fastModeLabel: "Быстро",
    hasModelStorage: false,
    helpBody: "Использует самую точную модель на WebGPU",
    helpLabel: "О максимальном качестве",
    optimalModeLabel: "Оптимально",
    path: "/udalit-fon-dlya-avatarki",
    pageTestId: "avatar-page",
    pasteHint: "Вставить из буфера обмена",
    uploadLabel: "Загрузить изображения",
  },
  {
    diagnosticsEmpty: "No diagnostic data yet",
    fastModeLabel: "Fast",
    hasModelStorage: false,
    helpBody: "Uses our most precise model on WebGPU",
    helpLabel: "About Maximum quality",
    optimalModeLabel: "Optimal",
    path: "/en/remove-background-from-id-photo",
    pageTestId: "document-photo-page",
    pasteHint: "Paste from clipboard",
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
    await expect(page.getByText(route.pasteHint, { exact: true })).toBeVisible();
    await expect(page.getByText("Ctrl/⌘ + V")).toBeVisible();
    await page.getByRole("button", { name: route.helpLabel }).click();
    await expect(page.getByText(new RegExp(route.helpBody))).toBeVisible();
    await page.locator('[data-slot="popover-content"]').getByRole("button").click();
    await expect(page.getByText(new RegExp(route.helpBody))).toHaveCount(0);
    const optimalMode = page.getByRole("radio", {
      name: new RegExp(route.optimalModeLabel),
    });
    await optimalMode.click();
    await expect(optimalMode).toBeChecked();
    const fastMode = page.getByRole("radio", {
      name: new RegExp(route.fastModeLabel),
    });
    await fastMode.click();
    await expect(fastMode).toBeChecked();
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

  await page.goto("/");
  await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Загрузить изображения").setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  const admissionError = page.locator('[data-file-admission-state="error"]');
  await expect(admissionError).toBeVisible();
  await expect(admissionError).toContainText("не поддерживается");
  await admissionError.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByLabel("Загрузить изображения")).toBeEnabled();
});

test("single-image processing keeps progress, comparison, and PNG export intact", async ({
  editor,
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Upload an image").setInputFiles(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);

  await editor.scenario.stage("model-loading", 0.4);
  await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
    "data-main-page-phase",
    "loading-model",
  );
  await expect(editor.progress.currentStage).toContainText("40");

  await editor.scenario.stage("automatic-remove", 0.5);
  await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
    "data-main-page-phase",
    "processing",
  );
  await editor.scenario.completeRun();
  await expect(page.getByRole("slider")).toBeVisible();

  await page.getByRole("button", { name: "Output options" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Original" })).toBeChecked();

  const download = await editor.exportPng.download();
  expect(download.suggestedFilename()).toBe("cutbg-result.png");
});

test("batch connectors keep admission, selection, and ZIP commands at their consumers", async ({
  editor,
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
  await page
    .getByLabel("Upload an image")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);

  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();
  await expect.poll(editor.scenario.runCount).toBe(2);
  await editor.scenario.completeRun();

  const batch = page.getByTestId("batch-overview");
  await expect(batch.locator("article")).toHaveCount(2);
  await expect(batch.getByText("Result ready")).toHaveCount(2);
  await batch
    .locator("article")
    .nth(1)
    .getByRole("button", { name: /Select / })
    .click();
  await expect(batch.locator("article").nth(1)).toHaveClass(/border-primary/);

  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download all/ }).click();
  expect((await pending).suggestedFilename()).toBe("cutbg-results.zip");
});
