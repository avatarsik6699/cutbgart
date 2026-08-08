import { readFile } from "node:fs/promises";

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
    await expect(
      page.getByRole("button", { name: new RegExp(`^${route.pasteHint}`) }),
    ).toBeVisible();
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

test("T11 admission, client mode, and delayed feedback stay truthful across responsive locales", async ({
  editor,
  page,
  request,
}) => {
  const serverMarkup = await (await request.get("/en")).text();
  const selectorMarkup = serverMarkup
    .split('data-testid="processing-mode-selector"')[1]
    ?.split("</fieldset>")[0];
  expect(selectorMarkup).toBeDefined();
  expect(selectorMarkup).not.toContain("checked");

  const clipboardBytes = [...(await readFile(phase33ImageCorpus.smoke.path))];
  await page.clock.install({ time: new Date("2026-08-08T08:00:00Z") });
  await page.addInitScript(
    ({ bytes }) => {
      const testWindow = window as Window & {
        __clipboardReadOutcome?: "denied" | "image";
      };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          read: () => {
            if (testWindow.__clipboardReadOutcome === "denied")
              return Promise.reject(
                new DOMException("Permission denied", "NotAllowedError"),
              );
            return Promise.resolve([
              {
                types: ["image/jpeg"],
                getType: () =>
                  Promise.resolve(
                    new Blob([Uint8Array.from(bytes)], { type: "image/jpeg" }),
                  ),
              },
            ]);
          },
        },
      });
    },
    { bytes: clipboardBytes },
  );

  const locales = [
    {
      delayed:
        "This is taking longer than usual. Keep this tab open; the image is still being processed locally on your device.",
      denied: "Clipboard permission was not granted. Use Ctrl/⌘ + V or choose a file.",
      maximum: "Maximum",
      paste: "Paste from clipboard",
      path: "/en",
      viewport: { width: 1280, height: 900 },
    },
    {
      delayed:
        "Обработка занимает больше времени, чем обычно. Не закрывайте вкладку: изображение всё ещё обрабатывается локально на вашем устройстве.",
      denied: "Доступ к буферу обмена не разрешён. Нажмите Ctrl/⌘ + V или выберите файл.",
      maximum: "Максимум",
      paste: "Вставить из буфера обмена",
      path: "/",
      viewport: { width: 390, height: 844 },
    },
  ] as const;

  for (const [localeIndex, locale] of locales.entries()) {
    await page.setViewportSize(locale.viewport);
    await page.goto(locale.path);
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
    await expect(
      page.getByRole("radio", { name: new RegExp(`^${locale.maximum}`) }),
    ).toBeChecked();
    const pasteButton = page.getByRole("button", {
      name: new RegExp(`^${locale.paste}`),
    });
    await expect(pasteButton).toBeVisible();
    const admissionSurface = page.locator('[data-file-admission-surface="true"]');
    await expect(admissionSurface).toBeVisible();
    await expect(
      admissionSurface.getByRole("button", {
        name: new RegExp(`^${locale.paste}`),
      }),
    ).toBeVisible();

    await page.evaluate(() => {
      (window as Window & { __clipboardReadOutcome?: string }).__clipboardReadOutcome =
        "denied";
    });
    await pasteButton.click();
    await expect(admissionSurface.getByRole("alert")).toContainText(locale.denied);

    await page.evaluate(() => {
      (window as Window & { __clipboardReadOutcome?: string }).__clipboardReadOutcome =
        "image";
    });
    if (localeIndex === 0) {
      await page.clock.pauseAt(new Date("2026-08-08T09:00:00Z"));
    }
    await pasteButton.click();
    await expect.poll(editor.scenario.runCount).toBe(1);
    await expect(page.getByTestId("delayed-processing-explanation")).toHaveCount(0);
    await page.clock.runFor(9_999);
    await expect(page.getByTestId("delayed-processing-explanation")).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(page.getByTestId("delayed-processing-explanation")).toHaveText(
      locale.delayed,
    );
    await editor.scenario.completeRun();
    await expect(page.getByTestId("delayed-processing-explanation")).toHaveCount(0);
    await editor.preview.resetButton.click();

    await page.evaluate(
      ({ bytes }) => {
        const file = new File([Uint8Array.from(bytes)], "keyboard-paste.jpg", {
          type: "image/jpeg",
        });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        window.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            clipboardData: transfer,
          }),
        );
      },
      { bytes: clipboardBytes },
    );
    await expect.poll(editor.scenario.runCount).toBe(2);
    await editor.scenario.completeRun();
    await editor.preview.resetButton.click();
  }
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

test("single-image model reprocessing preserves history, failure state, focus, and drafts in both locales", async ({
  editor,
  page,
}) => {
  const locales = [
    {
      path: "/en/",
      viewport: { width: 1280, height: 900 },
      upload: "Upload an image",
      modelLabels: { "isnet-q8": "ISNet Fast", "isnet-fp32": "ISNet Quality" },
      current: /^Current model:/,
      processing: /^Processing with/,
      reprocessPrefix: /^Reprocess in/,
      failure:
        "The selected model could not process this image. Your current result was preserved; choose a model to try again.",
      ocean: "Ocean",
      guard: "Finish this edit before switching tools",
      continueEditing: "Continue editing",
      discard: "Discard draft",
      undo: "Undo document change",
      redo: "Redo document change",
    },
    {
      path: "/",
      viewport: { width: 390, height: 844 },
      upload: "Загрузить изображения",
      modelLabels: { "isnet-q8": "ISNet Быстро", "isnet-fp32": "ISNet Качество" },
      current: /^Текущая модель:/,
      processing: /^Обработка моделью/,
      reprocessPrefix: /^Повторить в режиме/,
      failure:
        "Выбранная модель не смогла обработать изображение. Текущий результат сохранён; выберите модель для повторной попытки.",
      ocean: "Океан",
      guard: "Завершите правку перед сменой инструмента",
      continueEditing: "Продолжить редактирование",
      discard: "Отбросить черновик",
      undo: "Отменить изменение документа",
      redo: "Вернуть изменение документа",
    },
  ] as const;

  for (const locale of locales) {
    await page.setViewportSize(locale.viewport);
    await page.goto(locale.path);
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
    await page.getByLabel(locale.upload).setInputFiles(phase33ImageCorpus.smoke.path);
    await expect.poll(editor.scenario.runCount).toBe(1);
    await editor.scenario.completeRun();

    const control = page.getByTestId("automatic-model-control");
    const trigger = control.locator("button").first();
    const reprocessButton = control.locator("button").last();

    async function pick(mode: "isnet-fp32" | "isnet-q8"): Promise<void> {
      await trigger.click();
      await page.getByRole("menuitemradio", { name: locale.modelLabels[mode] }).click();
    }

    await expect(trigger).toHaveAccessibleName(locale.current);
    const initialMode = (await control.getAttribute("data-current-model")) as
      "isnet-fp32" | "isnet-q8";
    const alternateMode = initialMode === "isnet-q8" ? "isnet-fp32" : "isnet-q8";

    await pick(alternateMode);
    await reprocessButton.click();
    await expect.poll(editor.scenario.runCount).toBe(2);
    await expect(trigger).toHaveAccessibleName(locale.processing);
    await expect(trigger).toBeDisabled();
    expect((await editor.scenario.runModelModes()).at(-1)).toBe(alternateMode);
    await editor.progress.cancelButton.click();
    await expect(control).toHaveAttribute("data-current-model", initialMode);
    await expect(trigger).toBeFocused();

    await pick(alternateMode);
    await reprocessButton.click();
    await expect.poll(editor.scenario.runCount).toBe(3);
    await editor.scenario.failRun();
    await expect(page.getByRole("alert")).toContainText(locale.failure);
    await expect(control).toHaveAttribute("data-current-model", initialMode);
    await expect(trigger).toBeFocused();

    await pick(alternateMode);
    await reprocessButton.click();
    await expect.poll(editor.scenario.runCount).toBe(4);
    await editor.scenario.completeRun();
    await expect(control).toHaveAttribute("data-current-model", alternateMode);
    await expect(trigger).toBeFocused();
    const undo = page.getByRole("button", { name: locale.undo });
    const redo = page.getByRole("button", { name: locale.redo });
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(control).toHaveAttribute("data-current-model", initialMode);
    await redo.click();
    await expect(control).toHaveAttribute("data-current-model", alternateMode);

    await page.locator('[data-tool-id="background"]').click();
    await page.getByRole("button", { name: locale.ocean, exact: true }).click();
    await pick(initialMode);
    await reprocessButton.click();
    await expect(page.getByRole("heading", { name: locale.guard })).toBeVisible();
    await expect.poll(editor.scenario.runCount).toBe(4);
    await page.getByRole("button", { name: locale.continueEditing }).click();
    await expect(control).toHaveAttribute("data-current-model", alternateMode);
    await expect(page.getByTestId("tool-panel-slot")).toBeFocused();

    await pick(initialMode);
    await reprocessButton.click();
    await page.getByRole("button", { name: locale.discard }).click();
    await expect.poll(editor.scenario.runCount).toBe(5);
    await editor.scenario.completeRun();
    await expect(control).toHaveAttribute("data-current-model", initialMode);

    await editor.preview.resetButton.click();
    await expect.poll(editor.scenario.resourceCounts).toEqual({
      artifacts: 0,
      leases: 0,
      objectUrls: 0,
    });
  }
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
      enhancementApplying: "Encoding the enhanced result locally…",
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
      enhancementApplying: "Кодируем улучшенный результат локально…",
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
    const cutoutGrid = await page.getByTestId("cutout-stage-content").evaluate((el) => {
      const style = getComputedStyle(el);
      return { image: style.backgroundImage, size: style.backgroundSize };
    });

    await page.getByRole("button", { name: locale.background, exact: true }).click();
    const backgroundViewport = page.locator('[data-tool-image-viewport="true"]');
    await expect(backgroundViewport).toBeVisible();
    const backgroundAfterPreview = page.getByTestId("after-preview-background");
    await expect(backgroundAfterPreview).not.toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    const backgroundGrid = await backgroundAfterPreview.evaluate((el) => {
      const style = getComputedStyle(el);
      return { image: style.backgroundImage, size: style.backgroundSize };
    });
    expect(backgroundGrid).toEqual(cutoutGrid);

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

    const authoritativeImage = page
      .getByTestId("after-preview-background")
      .locator("img");

    await page.getByRole("button", { name: locale.ocean, exact: true }).click();
    await page.getByRole("button", { name: locale.apply, exact: true }).click();
    await expect.poll(editor.scenario.backgroundCommitCount).toBe(1);
    await expect(undo).toBeEnabled();
    const committedUrl = await authoritativeImage.getAttribute("src");
    expect(committedUrl).toMatch(/^blob:/);
    expect(committedUrl).not.toBe(initialUrl);

    await undo.click();
    await expect(redo).toBeEnabled();
    await expect
      .poll(() => authoritativeImage.getAttribute("src"))
      .not.toBe(committedUrl);
    const undoneUrl = await authoritativeImage.getAttribute("src");
    expect(undoneUrl).toMatch(/^blob:/);
    expect(undoneUrl).not.toBe(committedUrl);
    await redo.click();
    await expect(undo).toBeEnabled();
    await expect.poll(() => authoritativeImage.getAttribute("src")).not.toBe(undoneUrl);
    const redoneUrl = await authoritativeImage.getAttribute("src");
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
    // "before" is pinned to the original automatic result (unaffected by the
    // Background edit above); "after" tracks the current committed state.
    expect(enhancementSources).toHaveLength(2);
    expect(enhancementSources).toEqual(expect.arrayContaining([redoneUrl, initialUrl]));
    await page.getByRole("button", { name: locale.apply, exact: true }).click();
    await expect.poll(editor.scenario.enhancementRunCount).toBe(1);
    await expect(page.getByTestId("editor-stage-placeholder")).toContainText(
      locale.enhancementApplying,
    );
    await expect(
      page.getByTestId("editor-stage-placeholder").getByText(locale.enhancementApplying),
    ).toHaveClass(/sr-only/);
    await editor.scenario.completeEnhancement();
    await expect.poll(editor.scenario.enhancementRunCount).toBe(2);
    await editor.scenario.completeEnhancement();
    await expect(page.getByTestId("editor-stage-placeholder")).toHaveCount(0);
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

test("Magic edge-recovery Apply stays singular and reversible in both locales", async ({
  editor,
  page,
}) => {
  const locales = [
    {
      path: "/en/",
      upload: "Upload an image",
      canvas: "Paint Keep and Remove guidance on the image",
      controlsActive: "Workspace controls active",
      keep: "Keep",
      firstRunHint: "The first Magic Apply may take longer",
      manual: "Manual",
      magic: "Magic",
      manualCanvas: "Manual cutout canvas",
      erase: "Erase",
      restore: "Restore",
      remove: "Remove",
      apply: "Apply",
      undo: "Undo document change",
      resultAlt: "Image with background removed",
    },
    {
      path: "/",
      upload: "Загрузить изображения",
      canvas: "Нарисуйте подсказки «Сохранить» и «Удалить» на изображении",
      controlsActive: "Управление рабочей областью активно",
      keep: "Оставить",
      firstRunHint: "Первое применение Magic может занять больше времени",
      manual: "Вручную",
      magic: "Магия",
      manualCanvas: "Холст ручной коррекции",
      erase: "Стереть",
      restore: "Восстановить",
      remove: "Удалить",
      apply: "Применить",
      undo: "Отменить изменение документа",
      resultAlt: "Изображение с удалённым фоном",
    },
  ] as const;

  for (const locale of locales) {
    await page.goto(locale.path);
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");
    await page
      .getByLabel(locale.upload)
      .setInputFiles(phase33ImageCorpus.representative.path);
    await expect.poll(editor.scenario.runCount).toBe(1);
    await editor.scenario.completeRun();

    await page.getByRole("tab", { name: locale.manual, exact: true }).click();
    const manualCanvas = page.getByRole("img", { name: locale.manualCanvas });
    const manualBox = await manualCanvas.boundingBox();
    if (manualBox === null) throw new Error("Manual canvas is not visible");
    const centerAlpha = () =>
      manualCanvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("2d");
        if (context === null) return -1;
        return (
          context.getImageData(
            Math.floor(element.width / 2),
            Math.floor(element.height / 2),
            1,
            1,
          ).data[3] ?? -1
        );
      });
    await expect.poll(centerAlpha).toBeGreaterThan(0);
    await page.getByRole("button", { name: locale.erase, exact: true }).click();
    await manualCanvas.click({
      position: { x: manualBox.width / 2, y: manualBox.height / 2 },
    });
    await expect.poll(centerAlpha).toBe(0);
    await page.getByRole("button", { name: locale.restore, exact: true }).click();
    await manualCanvas.click({
      position: { x: manualBox.width / 2, y: manualBox.height / 2 },
    });
    await expect.poll(centerAlpha).toBeGreaterThan(0);
    await page.getByRole("tab", { name: locale.magic, exact: true }).click();

    const canvas = page.getByLabel(locale.canvas);
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("Magic canvas is not visible");
    await expect(page.getByText(locale.firstRunHint, { exact: false })).toBeVisible();
    const viewport = page.getByTestId("cutout-stage-viewport");
    await canvas.hover();
    await expect(viewport).toHaveAttribute("data-workspace-active", "true");
    await expect(page.getByText(locale.controlsActive)).toBeVisible();
    const pageScrollBeforeWheel = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -120);
    await expect(viewport).toHaveAttribute("data-zoom", "1.25");
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBeforeWheel);
    await page.keyboard.down("Control");
    await page.keyboard.press("=");
    await page.keyboard.up("Control");
    await expect(viewport).toHaveAttribute("data-zoom", "1.5");
    await page.keyboard.down("Control");
    await page.keyboard.press("0");
    await page.keyboard.up("Control");
    await expect(viewport).toHaveAttribute("data-zoom", "1");
    const pageScrollBeforePan = await page.evaluate(() => window.scrollY);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down("Space");
    await expect(viewport).toHaveAttribute("data-space-panning", "true");
    await expect(canvas).toHaveCSS("cursor", "grab");
    await page.mouse.down({ button: "left" });
    await expect(viewport).toHaveAttribute("data-panning", "true");
    await expect(canvas).toHaveCSS("cursor", "grabbing");
    await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 12);
    await page.mouse.up({ button: "left" });
    await page.keyboard.up("Space");
    await expect(viewport).toHaveAttribute("data-space-panning", "false");
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBeforePan);
    await page.mouse.down({ button: "middle" });
    await expect(viewport).toHaveAttribute("data-panning", "true");
    await expect(canvas).toHaveCSS("cursor", "grabbing");
    await page.mouse.up({ button: "middle" });
    await expect(viewport).toHaveAttribute("data-panning", "false");
    const baselineUrl = await page
      .getByRole("img", { name: locale.resultAlt })
      .getAttribute("src");
    const y = box.height / 2;
    await page.getByRole("button", { name: locale.remove, exact: true }).click();
    await canvas.click({ position: { x: box.width / 2 - 4, y } });
    await page.getByRole("button", { name: locale.keep, exact: true }).click();
    await canvas.click({ position: { x: box.width / 2 + 4, y } });
    await page.getByRole("button", { name: locale.apply, exact: true }).click();

    await expect.poll(editor.scenario.magicPredictionCount).toBe(1);
    await expect.poll(editor.scenario.magicCommitCount).toBe(1);
    await expect(page.getByRole("button", { name: locale.undo })).toBeEnabled();
    await expect
      .poll(() => page.getByRole("img", { name: locale.resultAlt }).getAttribute("src"))
      .not.toBe(baselineUrl);

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
  const admissionGroup = page.getByRole("group", {
    name: "Processing mode and admission for new images",
  });
  await expect(admissionGroup).toBeVisible();
  await expect(admissionGroup).not.toContainText("Mode for new images");
  await expect(admissionGroup).toContainText("Maximum");
  await expect(admissionGroup).toContainText("Add images");
  await expect(batch.locator("article")).toHaveCount(2);
  await expect(batch.getByText("Result ready")).toHaveCount(2);
  await expect(page.getByTestId("automatic-model-control")).toHaveCount(0);
  expect(await editor.scenario.runModelModes()).toHaveLength(2);
  await batch
    .locator("article")
    .nth(1)
    .getByRole("button", { name: /Select / })
    .click();
  await expect(batch.locator("article").nth(1)).toHaveClass(/border-primary/);

  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Output options" }).click();
  await page.getByRole("menuitem", { name: /Download all/ }).click();
  expect((await pending).suggestedFilename()).toBe("cutbg-results.zip");
});

test("batch item retry offers a per-item model choice and actually reprocesses", async ({
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
  // The first item is auto-focused as the active document (open draft), so
  // only the second item is eligible for an in-place batch-menu reprocess.
  const article = batch.locator("article").nth(1);
  const menu = page.getByRole("menu", { name: /Actions for/ });

  const modeLabels = { "isnet-q8": "Fast", "isnet-fp32": "Optimal" } as const;
  const initialMode = (await editor.scenario.runModelModes())[1] as
    "isnet-fp32" | "isnet-q8";
  const alternateMode = initialMode === "isnet-q8" ? "isnet-fp32" : "isnet-q8";

  await article.getByTestId("batch-item-actions").click();
  const retryAction = menu.getByRole("menuitem", { name: "Try again" });
  // Retrying in the item's own already-committed mode is not offered: the
  // domain rejects a same-model reprocess as a no-op, which is exactly what
  // made the old fixed "Retry in <mode> mode" action silently do nothing.
  await expect(retryAction).toBeDisabled();
  await menu
    .getByRole("menuitemradio", { name: modeLabels[alternateMode], exact: true })
    .click();
  await expect(retryAction).toBeEnabled();
  await retryAction.click();
  await expect.poll(editor.scenario.runCount).toBe(3);
  expect((await editor.scenario.runModelModes())[2]).toBe(alternateMode);
  await editor.scenario.completeRun();
});

test("T13 theme toggle is keyboard-accessible and localized, scrollbars stay themed, and navigation progress reflects real router state", async ({
  page,
}) => {
  const locales = [
    {
      path: "/",
      toLight: "Переключить на светлую тему",
      toDark: "Переключить на тёмную тему",
      viewport: { width: 390, height: 844 },
    },
    {
      path: "/en",
      toLight: "Switch to light theme",
      toDark: "Switch to dark theme",
      viewport: { width: 1280, height: 900 },
    },
  ] as const;

  for (const locale of locales) {
    await page.setViewportSize(locale.viewport);
    await page.goto(locale.path);
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-hydrated", "true");

    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);
    const darkBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    const darkScrollbarColor = await page.evaluate(
      () => getComputedStyle(document.body).scrollbarColor,
    );

    const toggle = page.getByRole("button", { name: locale.toLight });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(html).not.toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: locale.toDark })).toBeFocused();

    const lightBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    const lightScrollbarColor = await page.evaluate(
      () => getComputedStyle(document.body).scrollbarColor,
    );
    expect(lightBackground).not.toBe(darkBackground);
    expect(lightScrollbarColor).not.toBe(darkScrollbarColor);

    await page.keyboard.press("Enter");
    await expect(html).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: locale.toLight })).toBeFocused();

    const progress = page.locator('[data-slot="navigation-progress"]');
    await expect(progress).toHaveAttribute("aria-hidden", "true");
    await expect(progress).toHaveAttribute("data-active", "false");
    await expect(progress.locator(".navigation-progress-bar")).toHaveCSS("opacity", "0");
  }
});
