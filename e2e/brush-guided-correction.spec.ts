import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icon-512.png",
);
const AUTOMATIC_FLOW_SAMPLES = [
  {
    name: "portrait",
    file: path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "public",
      "images",
      "document-photo-example.webp",
    ),
    ratio: 1086 / 1448,
  },
  {
    name: "landscape",
    file: path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "public",
      "og-image.png",
    ),
    ratio: 1536 / 1024,
  },
] as const;

test.beforeEach(async ({ page }) => installMockInference(page));

async function brushStroke(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
): Promise<void> {
  const image = page.getByRole("img", {
    name: /brush-guided object correction|коррекции объекта кистью/i,
  });
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Guided brush image has no bounding box");
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  const cursor = page.getByTestId("guided-brush-cursor");
  const hoverCursor = await cursor.boundingBox();
  await page.mouse.down();
  const pressedCursor = await cursor.boundingBox();
  if (!hoverCursor || !pressedCursor)
    throw new Error("Guided brush cursor has no bounding box");
  expect(
    Math.hypot(
      hoverCursor.x + hoverCursor.width / 2 - pressedCursor.x - pressedCursor.width / 2,
      hoverCursor.y + hoverCursor.height / 2 - pressedCursor.y - pressedCursor.height / 2,
    ),
  ).toBeLessThan(1);
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1]);
  await page.mouse.up();
}

async function guidedPromptPosts(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as {
        __mockInferencePosts: Array<{
          type: string;
          revision?: number;
          pointLabels?: number[];
          promptPoints?: Array<{ x: number; y: number; label: number }>;
        }>;
      }
    ).__mockInferencePosts.filter((post) => post.type === "prompt"),
  );
}

const locales = [
  {
    path: "/en",
    method: /Guide with a brush/,
    upload: "Upload an image",
    keep: /^Keep$/,
    remove: /^Remove$/,
    size: /Guided brush size/,
    undo: /Undo marking/,
    redo: /Redo marking/,
    clear: /Clear markings/,
    recompute: /Recompute mask/,
    nextResult: /Next result/,
    markingsTab: /^Markings$/,
    resultTab: /^Result$/,
    continueResult: /Continue from this result/,
    accept: /Accept and refine/,
    refine: /^Refine edges$/,
    refineAgain: /^Refine again$/,
    clean: /^Clean edge colours$/,
    cleanAgain: /^Clean again$/,
    exactBrush: /Skip and edit with brush/,
    editor: /mask correction editor/i,
    done: /^Done$/,
    ocean: "Ocean",
    save: /^Save background$/,
    download: /^Download$/,
  },
  {
    path: "/",
    method: /Указать кистью/,
    upload: "Загрузить изображения",
    keep: /^Оставить$/,
    remove: /^Удалить$/,
    size: /Размер управляемой кисти/,
    undo: /Отменить отметку/,
    redo: /Вернуть отметку/,
    clear: /Очистить отметки/,
    recompute: /Пересчитать маску/,
    nextResult: /Следующий результат/,
    markingsTab: /^Отметки$/,
    resultTab: /^Результат$/,
    continueResult: /Продолжить с этого результата/,
    accept: /Принять и уточнить/,
    refine: /^Уточнить края$/,
    refineAgain: /^Уточнить ещё раз$/,
    clean: /^Очистить цвет краёв$/,
    cleanAgain: /^Очистить ещё раз$/,
    exactBrush: /Пропустить и править кистью/,
    editor: /редактор маски/i,
    done: /^Готово$/,
    ocean: "Океан",
    save: /^Сохранить фон$/,
    download: /^Скачать$/,
  },
] as const;

for (const locale of locales) {
  test(`direct brush guidance is explicit and continues through the result pipeline (${locale.path})`, async ({
    page,
  }) => {
    await page.goto(locale.path);
    const method = page.getByRole("button", { name: locale.method });
    await expect(method).toBeEnabled();
    await method.click();
    await page.getByLabel(locale.upload).setInputFiles(SAMPLE);
    const guided = page.getByTestId("guided-brush-selection");
    await expect(guided).toBeVisible();
    await expect(guided.getByText(/Paint Keep|Нарисуйте.*Оставить/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      guided.getByRole("button", { name: /point|точк|box|рамк/i }),
    ).toHaveCount(0);

    await guided.getByRole("button", { name: locale.remove }).click();
    const brushSize = guided.getByRole("slider", { name: locale.size });
    const sizeSwatch = guided.getByTestId("guided-brush-size-swatch");
    const initialSwatch = await sizeSwatch.boundingBox();
    await brushSize.focus();
    await brushSize.press("Home");
    await expect(brushSize).toHaveValue("2");
    const smallSwatch = await sizeSwatch.boundingBox();
    expect(smallSwatch?.width).toBeLessThan(initialSwatch?.width ?? Infinity);
    await brushStroke(page, [0.68, 0.42], [0.78, 0.58]);
    const cursorBox = await guided.getByTestId("guided-brush-cursor").boundingBox();
    expect(Math.abs((cursorBox?.width ?? 0) - (cursorBox?.height ?? 1))).toBeLessThan(1);
    await expect(guided.getByRole("button", { name: locale.recompute })).toBeDisabled();
    await guided.getByRole("button", { name: locale.keep }).click();
    await brushStroke(page, [0.25, 0.35], [0.42, 0.65]);
    expect(await guidedPromptPosts(page)).toHaveLength(0);

    await guided.getByRole("button", { name: locale.undo }).click();
    await guided.getByRole("button", { name: locale.redo }).click();
    await guided.getByRole("button", { name: locale.clear }).click();
    expect(await guidedPromptPosts(page)).toHaveLength(0);

    await guided.getByRole("button", { name: locale.keep }).click();
    await brushStroke(page, [0.25, 0.35], [0.42, 0.65]);
    await expect(guided).toHaveAttribute("data-keep-stroke-count", "1");
    await guided.getByRole("button", { name: locale.remove }).click();
    await brushStroke(page, [0.68, 0.42], [0.78, 0.58]);
    await expect(guided).toHaveAttribute("data-stroke-count", "2");
    await guided.getByRole("button", { name: locale.recompute }).click();

    const candidates = page.getByTestId("guided-brush-candidates");
    await expect(candidates).toBeVisible();
    await expect(candidates).toHaveAttribute("data-candidate-count", /[1-3]/);
    const posts = await guidedPromptPosts(page);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.pointLabels?.length).toBeLessThanOrEqual(32);
    expect(posts[0]?.pointLabels).toContain(1);
    expect(posts[0]?.pointLabels).toContain(0);
    await expect(candidates).not.toContainText(
      /quality estimate|estimate unavailable|оценка качества|недоступна|\/100/,
    );

    const resultCanvas = page.getByTestId("guided-brush-result-canvas");
    await expect(resultCanvas).toBeVisible();
    const firstPreview = await resultCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    if (Number(await candidates.getAttribute("data-candidate-count")) > 1) {
      await candidates.getByRole("button", { name: locale.nextResult }).click();
      await expect
        .poll(() =>
          resultCanvas.evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
        )
        .not.toBe(firstPreview);
    }

    const promptCountBeforeContinue = (await guidedPromptPosts(page)).length;
    await guided.getByRole("button", { name: locale.continueResult }).click();
    await expect(guided).toHaveAttribute("data-stroke-count", "0");
    await expect(candidates).toHaveCount(0);
    await expect(guided.getByRole("button", { name: locale.accept })).toBeEnabled();
    expect(await guidedPromptPosts(page)).toHaveLength(promptCountBeforeContinue);

    await guided.getByRole("button", { name: locale.remove }).click();
    await brushStroke(page, [0.6, 0.4], [0.72, 0.55]);
    await expect(guided.getByTestId("guided-brush-result-stale")).toHaveCount(1);
    const resultTab = guided.getByRole("tab", { name: locale.resultTab });
    if (await resultTab.isVisible()) {
      await resultTab.click();
      await expect(guided.getByTestId("guided-brush-result-stale")).toBeVisible();
      await guided.getByRole("tab", { name: locale.markingsTab }).click();
    } else {
      await expect(guided.getByTestId("guided-brush-result-stale")).toBeVisible();
    }
    await guided.getByRole("button", { name: locale.recompute }).click();
    await expect(page.getByTestId("guided-brush-candidates")).toBeVisible();
    await expect(guided.getByTestId("guided-brush-result-stale")).toHaveCount(0);

    await guided.getByRole("button", { name: locale.accept }).click();
    const matte = page.getByTestId("matte-refinement-controls");
    await matte.getByRole("button", { name: locale.refine }).click();
    await expect(matte.getByRole("button", { name: locale.refineAgain })).toBeVisible();
    const foreground = page.getByTestId("foreground-refinement-controls");
    await foreground.getByRole("button", { name: locale.clean }).click();
    await expect(
      foreground.getByRole("button", { name: locale.cleanAgain }),
    ).toBeVisible();
    await foreground.getByRole("button", { name: locale.exactBrush }).click();
    await expect(page.getByRole("application", { name: locale.editor })).toBeVisible();
    await page.getByRole("button", { name: locale.done }).click();
    await page.getByRole("button", { name: locale.ocean }).click();
    const save = page.getByRole("button", { name: locale.save });
    await save.click();
    await expect(save).toBeDisabled();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: locale.download }).click();
    expect((await download).suggestedFilename()).toBe("result.png");
  });
}

for (const sample of AUTOMATIC_FLOW_SAMPLES) {
  test(`automatic ${sample.name} result becomes an undistorted guided editing base`, async ({
    page,
  }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(sample.file);
    await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /Refine selection with brush/ }).click();

    const workspace = page.getByTestId("tool-workspace");
    const guided = page.getByTestId("guided-brush-selection");
    await expect(guided).toBeVisible();
    await expect(guided.getByText(/automatic result is the editing base/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(guided.getByTestId("guided-brush-removed-context-legend")).toBeVisible();

    const editFrame = guided.getByTestId("guided-brush-edit-frame");
    await expect(editFrame).toBeVisible();
    const editBox = await editFrame.boundingBox();
    expect(editBox).not.toBeNull();
    expect(Math.abs(editBox!.width / editBox!.height - sample.ratio)).toBeLessThan(0.02);
    const editPaneBox = await guided
      .getByTestId("guided-brush-markings-pane")
      .boundingBox();
    expect(editBox!.width).toBeLessThanOrEqual((editPaneBox?.width ?? 0) + 1);

    await expect
      .poll(() =>
        guided.getByTestId("guided-brush-edit-image").evaluate((node) => {
          const context = (node as HTMLCanvasElement).getContext("2d");
          return context?.getImageData(0, 0, 1, 1).data[3] ?? 0;
        }),
      )
      .toBeGreaterThan(128);

    const resultTab = guided.getByRole("tab", { name: /^Result$/ });
    const usesTabs = await resultTab.isVisible();
    if (usesTabs) await resultTab.click();
    const resultFrame = guided.getByTestId("guided-brush-result-checkerboard");
    await expect(resultFrame).toBeVisible();
    const resultBox = await resultFrame.boundingBox();
    expect(resultBox).not.toBeNull();
    expect(Math.abs(resultBox!.width / resultBox!.height - sample.ratio)).toBeLessThan(
      0.02,
    );
    expect(Math.abs(resultBox!.width - editBox!.width)).toBeLessThan(2);
    expect(Math.abs(resultBox!.height - editBox!.height)).toBeLessThan(2);

    if (!usesTabs) {
      expect(Math.abs(resultBox!.y - editBox!.y)).toBeLessThan(2);
      const workspaceBox = await workspace.boundingBox();
      const guidedBox = await guided.boundingBox();
      expect(guidedBox!.width / workspaceBox!.width).toBeGreaterThan(0.95);
    }

    const posts = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mockInferencePosts: Array<{
              type: string;
              sourceIsOriginal?: boolean;
            }>;
          }
        ).__mockInferencePosts,
    );
    expect(posts.filter((post) => post.type === "encode").at(-1)?.sourceIsOriginal).toBe(
      true,
    );
  });
}

test("separated automatic-base markings cannot change the untouched area between them", async ({
  page,
}) => {
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(AUTOMATIC_FLOW_SAMPLES[1].file);
  await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Refine selection with brush/ }).click();
  const guided = page.getByTestId("guided-brush-selection");
  await expect(guided).toBeVisible();
  await guided.getByRole("button", { name: /^Remove$/ }).click();
  await brushStroke(page, [0.18, 0.5], [0.2, 0.5]);
  await brushStroke(page, [0.8, 0.5], [0.82, 0.5]);
  await guided.getByRole("button", { name: /Recompute mask/ }).click();

  const resultCanvas = guided.getByTestId("guided-brush-result-canvas");
  await expect(resultCanvas).toBeVisible();
  const alphaAt = (x: number, y: number) =>
    resultCanvas.evaluate(
      (node, point) => {
        const canvas = node as HTMLCanvasElement;
        const context = canvas.getContext("2d");
        if (!context) return -1;
        return (
          context.getImageData(
            Math.min(canvas.width - 1, Math.floor(canvas.width * point.x)),
            Math.min(canvas.height - 1, Math.floor(canvas.height * point.y)),
            1,
            1,
          ).data[3] ?? -1
        );
      },
      { x, y },
    );
  await expect.poll(() => alphaAt(0.2, 0.5)).toBe(0);
  await expect
    .poll(() => Promise.all([alphaAt(0.4, 0.5), alphaAt(0.5, 0.5), alphaAt(0.6, 0.5)]))
    .toEqual([255, 255, 255]);
});

test("the tolerance halo can cross a boundary without forcing either semantic intent", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__mockBoundaryTolerantGuidedCandidate", {
      configurable: true,
      value: true,
    });
  });
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(AUTOMATIC_FLOW_SAMPLES[1].file);
  await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Refine selection with brush/ }).click();

  const guided = page.getByTestId("guided-brush-selection");
  await expect(guided.getByTestId("guided-brush-tolerance-hint")).toContainText(
    /inner core.*outer halo/i,
  );
  const brushSize = guided.getByRole("slider", { name: /Guided brush size/ });
  await brushSize.evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "90";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(brushSize).toHaveValue("90");

  await guided.getByRole("button", { name: /^Remove$/ }).click();
  await brushStroke(page, [0.47, 0.35], [0.47, 0.35]);
  const haloRadius = Number(
    await guided.getByTestId("guided-brush-cursor").getAttribute("r"),
  );
  const coreRadius = Number(
    await guided.getByTestId("guided-brush-core-cursor").getAttribute("r"),
  );
  expect(coreRadius / haloRadius).toBeCloseTo(0.35, 1);

  await guided.getByRole("button", { name: /^Keep$/ }).click();
  await brushStroke(page, [0.53, 0.65], [0.53, 0.65]);
  await guided.getByRole("button", { name: /Recompute mask/ }).click();

  const posts = await guidedPromptPosts(page);
  const points = posts.at(-1)?.promptPoints ?? [];
  expect(
    points.some((point) => point.label === 0 && Math.abs(point.x - 0.47) < 0.01),
  ).toBe(true);
  expect(
    points.some((point) => point.label === 1 && Math.abs(point.x - 0.53) < 0.01),
  ).toBe(true);

  const resultCanvas = guided.getByTestId("guided-brush-result-canvas");
  await expect(resultCanvas).toBeVisible();
  const alphaAt = (x: number, y: number) =>
    resultCanvas.evaluate(
      (node, point) => {
        const canvas = node as HTMLCanvasElement;
        const context = canvas.getContext("2d");
        if (!context) return -1;
        return (
          context.getImageData(
            Math.min(canvas.width - 1, Math.floor(canvas.width * point.x)),
            Math.min(canvas.height - 1, Math.floor(canvas.height * point.y)),
            1,
            1,
          ).data[3] ?? -1
        );
      },
      { x, y },
    );

  await expect.poll(() => alphaAt(0.51, 0.35)).toBe(255);
  await expect.poll(() => alphaAt(0.49, 0.65)).toBe(0);
});

test("automatic-result guidance collapses duplicates and rejects an older session response", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__mockCollapseGuidedCandidates", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(window, "__mockDelayFirstGuidedResponse", {
      configurable: true,
      value: true,
    });
  });
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Refine selection with brush/ }).click();
  await expect(page.getByTestId("guided-brush-selection")).toBeVisible();
  await page.getByRole("button", { name: /^Remove$/ }).click();
  await brushStroke(page, [0.65, 0.4], [0.75, 0.6]);
  await page.getByRole("button", { name: /Recompute mask/ }).click();
  await page.getByRole("button", { name: /Cancel guided selection/ }).click();

  await page.getByRole("button", { name: /Refine selection with brush/ }).click();
  await page.getByRole("button", { name: /^Remove$/ }).click();
  await brushStroke(page, [0.55, 0.4], [0.7, 0.6]);
  await page.getByRole("button", { name: /Recompute mask/ }).click();
  const candidates = page.getByTestId("guided-brush-candidates");
  await expect(candidates).toBeVisible();
  await expect(candidates).toHaveAttribute("data-candidate-count", "1");
  await expect(candidates).toContainText(/materially identical/);
  await expect(page.getByTestId("guided-brush-current-result")).toHaveAttribute(
    "data-candidate-id",
    /mock-2-/,
  );
  await page.waitForTimeout(350);
  await expect(page.getByTestId("guided-brush-current-result")).toHaveAttribute(
    "data-candidate-id",
    /mock-2-/,
  );
  await expect(candidates).not.toContainText(/score|estimate|unavailable|\/100/i);

  await page.getByRole("button", { name: /Accept and refine/ }).click();
  await page
    .getByTestId("matte-refinement-controls")
    .getByRole("button", { name: /Skip and edit with brush/ })
    .click();
  await expect(
    page.getByRole("application", { name: /mask correction editor/i }),
  ).toBeVisible();
});

test("a settled batch item uses the same brush session and returns to batch controls", async ({
  page,
}) => {
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([SAMPLE, SAMPLE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");
  await page
    .getByRole("button", { name: /Select icon-512\.png for review/ })
    .first()
    .click();
  const batchControls = page.getByTestId("batch-controls");
  await batchControls
    .getByRole("button", { name: /Refine selection with brush/ })
    .click();
  const guided = page.getByTestId("guided-brush-selection");
  await expect(guided).toBeVisible();
  const reviewButtons = page.getByRole("button", {
    name: /Select icon-512\.png for review/,
  });
  await expect(reviewButtons).toHaveCount(2);
  await reviewButtons.nth(1).click();
  await expect(guided).toHaveCount(0);
  await expect(batchControls).toBeVisible();
  await batchControls
    .getByRole("button", { name: /Refine selection with brush/ })
    .click();
  await expect(guided).toBeVisible();
  await guided.getByRole("button", { name: /^Remove$/ }).click();
  await brushStroke(page, [0.62, 0.4], [0.75, 0.6]);
  await guided.getByRole("button", { name: /Recompute mask/ }).click();
  await expect(page.getByTestId("guided-brush-candidates")).toBeVisible();
  await guided.getByRole("button", { name: /Accept and refine/ }).click();
  await expect(page.getByTestId("batch-controls")).toBeVisible();
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");
});

test("clearing a batch also disposes its active guided session", async ({ page }) => {
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([SAMPLE, SAMPLE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");
  await page
    .getByRole("button", { name: /Select icon-512\.png for review/ })
    .first()
    .click();
  await page
    .getByTestId("batch-controls")
    .getByRole("button", { name: /Refine selection with brush/ })
    .click();
  await expect(page.getByTestId("guided-brush-selection")).toBeVisible();

  await page.getByRole("button", { name: /Clear batch/ }).click();

  await expect(page.getByTestId("guided-brush-selection")).toHaveCount(0);
  await expect(page.getByTestId("scheduler-summary")).toHaveCount(0);
  await expect(page.getByLabel("Upload an image")).toBeEnabled();
});
