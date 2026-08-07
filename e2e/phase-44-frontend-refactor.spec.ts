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

  const workspace = page.getByTestId("editor-tool-workspace");
  await expect(workspace).toHaveAttribute("data-active-tool", "cutout");
  await page.locator('[data-tool-id="background"]').click();
  await expect(workspace).toHaveAttribute("data-active-tool", "background");
  await page.getByLabel("Choose background colour").fill("#224466");
  await page.locator('[data-tool-id="enhance"]').click();
  await expect(
    page.getByRole("heading", { name: "Finish this edit before switching tools" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(workspace).toHaveAttribute("data-active-tool", "enhance");
});

test("committed history, Background preview, and tool viewports stay coherent in both locales", async ({
  editor,
  page,
}) => {
  const locales = [
    {
      path: "/en/",
      upload: "Upload an image",
      cutout: "Cutout",
      background: "Background",
      enhancements: "Enhancements",
      ocean: "Ocean",
      apply: "Apply",
      cancel: "Cancel",
      chooseBackground: "Choose background image",
      resultAlt: "Image with background removed",
      comparisonAlt: "Image before and after background removal",
      undo: "Undo document change",
      redo: "Redo document change",
    },
    {
      path: "/",
      upload: "Загрузить изображения",
      cutout: "Вырезание",
      background: "Фон",
      enhancements: "Улучшения",
      ocean: "Океан",
      apply: "Применить",
      cancel: "Отмена",
      chooseBackground: "Выбрать изображение для фона",
      resultAlt: "Изображение с удалённым фоном",
      comparisonAlt: "Изображение до и после удаления фона",
      undo: "Отменить изменение документа",
      redo: "Вернуть изменение документа",
    },
  ] as const;

  for (const locale of locales) {
    await page.goto(locale.path);
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
    await page.getByLabel(locale.upload).setInputFiles(phase33ImageCorpus.smoke.path);
    await expect.poll(editor.scenario.runCount).toBe(1);
    await editor.scenario.completeRun();

    const undo = page.getByRole("button", { name: locale.undo });
    const redo = page.getByRole("button", { name: locale.redo });
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    const initialUrl = await page
      .getByRole("img", { name: locale.resultAlt })
      .getAttribute("src");
    expect(initialUrl).toMatch(/^blob:/);
    const cutoutViewport = await page
      .locator('[data-tool-image-viewport="true"]')
      .boundingBox();

    await page.getByRole("button", { name: locale.background, exact: true }).click();
    const backgroundViewport = page.locator('[data-tool-image-viewport="true"]');
    await expect(backgroundViewport).toBeVisible();
    await page.getByRole("button", { name: locale.ocean, exact: true }).click();
    await expect(page.getByTestId("after-preview-background")).toHaveCSS(
      "background-image",
      /gradient/,
    );
    await page
      .getByLabel(locale.chooseBackground)
      .setInputFiles(phase33ImageCorpus.smoke.path);
    await expect.poll(editor.scenario.backgroundPreparationCount).toBe(1);
    await expect(page.getByTestId("after-preview-background")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    await page.getByRole("button", { name: locale.cancel, exact: true }).click();
    await expect.poll(editor.scenario.backgroundCommitCount).toBe(0);
    await expect(undo).toBeDisabled();
    await expect(page.getByRole("img", { name: locale.comparisonAlt })).toHaveAttribute(
      "src",
      initialUrl!,
    );

    await page.getByRole("button", { name: locale.ocean, exact: true }).click();
    await page.getByRole("button", { name: locale.apply, exact: true }).click();
    await expect.poll(editor.scenario.backgroundCommitCount).toBe(1);
    await expect(undo).toBeEnabled();
    const committedUrl = await page
      .getByRole("img", { name: locale.comparisonAlt })
      .getAttribute("src");
    expect(committedUrl).toMatch(/^blob:/);
    expect(committedUrl).not.toBe(initialUrl);

    await undo.click();
    await expect(redo).toBeEnabled();
    await expect
      .poll(() =>
        page.getByRole("img", { name: locale.comparisonAlt }).getAttribute("src"),
      )
      .not.toBe(committedUrl);
    const undoneUrl = await page
      .getByRole("img", { name: locale.comparisonAlt })
      .getAttribute("src");
    expect(undoneUrl).toMatch(/^blob:/);
    expect(undoneUrl).not.toBe(committedUrl);
    await redo.click();
    await expect(undo).toBeEnabled();
    await expect
      .poll(() =>
        page.getByRole("img", { name: locale.comparisonAlt }).getAttribute("src"),
      )
      .not.toBe(undoneUrl);
    const redoneUrl = await page
      .getByRole("img", { name: locale.comparisonAlt })
      .getAttribute("src");
    expect(redoneUrl).toMatch(/^blob:/);
    expect(redoneUrl).not.toBe(undoneUrl);

    const backgroundBox = await backgroundViewport.boundingBox();
    await page.getByRole("button", { name: locale.enhancements, exact: true }).click();
    const enhancementViewport = page.locator('[data-tool-image-viewport="true"]');
    const enhancementBox = await enhancementViewport.boundingBox();
    const enhancementSources = await enhancementViewport
      .locator("img")
      .evaluateAll((images) => [
        ...new Set(images.map((image) => image.getAttribute("src"))),
      ]);
    expect(enhancementSources).toEqual([redoneUrl]);
    await page.getByRole("button", { name: locale.cutout, exact: true }).click();
    const reopenedCutoutBox = await page
      .locator('[data-tool-image-viewport="true"]')
      .boundingBox();

    for (const box of [backgroundBox, enhancementBox, reopenedCutoutBox]) {
      expect(box).not.toBeNull();
      expect(cutoutViewport).not.toBeNull();
      expect(Math.abs(box!.width - cutoutViewport!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.height - cutoutViewport!.height)).toBeLessThanOrEqual(1);
    }

    await editor.preview.resetButton.click();
    await expect.poll(editor.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
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
