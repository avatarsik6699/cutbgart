import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const sampleImage = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);
const mediumImage = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icon-512.png",
);

async function paintMagicStroke(page: Page): Promise<void> {
  const image = page.getByRole("img", {
    name: /brush-guided object correction|коррекции объекта кистью/i,
  });
  const box = await image.boundingBox();
  if (!box) throw new Error("Magic canvas has no bounding box");
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
    steps: 4,
  });
  await page.mouse.up();
}

for (const locale of ["en", "ru"] as const) {
  test(`${locale}: upload preparation stays responsive and completes three items`, async ({
    page,
  }) => {
    await installMockInference(page);
    await page.goto(locale === "ru" ? "/" : "/en");
    const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
    await expect(upload).toBeEnabled();

    await page.evaluate(() => {
      const durations: number[] = [];
      Object.defineProperty(window, "__phase32LongTaskDurations", {
        configurable: true,
        value: durations,
      });
      new PerformanceObserver((list) => {
        durations.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: "longtask", buffered: true });
    });
    await upload.setInputFiles([sampleImage, sampleImage, sampleImage]);
    const longestMainThreadTask = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const durations = (
                window as unknown as { __phase32LongTaskDurations: number[] }
              ).__phase32LongTaskDurations;
              resolve(Math.max(0, ...durations));
            }),
          );
        }),
    );
    expect(longestMainThreadTask).toBeLessThan(100);

    await expect(page.getByTestId("batch-item-thumbnail")).toHaveCount(3, {
      timeout: 15_000,
    });
    const preparationCount = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mockInferencePosts: Array<{ type: string }>;
          }
        ).__mockInferencePosts.filter((message) => message.type === "prepare").length,
    );
    expect(preparationCount).toBe(3);
  });

  for (const uploadMode of ["single", "multiple"] as const) {
    test(`${locale}: ${uploadMode} Cutout Cancel and tool churn keep controls responsive`, async ({
      page,
    }) => {
      await installMockInference(page);
      await page.goto(locale === "ru" ? "/" : "/en");
      const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
      await expect(upload).toBeEnabled();
      await upload.setInputFiles(
        uploadMode === "single" ? [sampleImage] : [sampleImage, sampleImage, sampleImage],
      );
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              (
                window as unknown as {
                  __mockInferencePosts: Array<{ type: string }>;
                }
              ).__mockInferencePosts.map((message) => message.type),
            ),
          { timeout: 15_000 },
        )
        .toContain("load-model");
      await expect(page.getByTestId("guided-brush-controls")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTestId("canvas-view-controls")).toBeVisible();

      await page.getByRole("button", { name: /^(Cancel|Отмена)$/ }).click();
      await expect(page.getByRole("status").first()).toContainText(
        /Cutout draft cleared|Черновик вырезания очищен/,
      );
      await page.getByRole("button", { name: /^(Background|Фон)$/ }).click();
      await expect(page.getByTestId("canvas-view-controls")).toHaveCount(0);
      const backgroundPanel = page.getByTestId("background-tool-panel");
      await backgroundPanel
        .getByRole("button", { name: /Background color|Цвет фона/ })
        .click();
      await expect(
        backgroundPanel.getByRole("slider", {
          name: /Color saturation and brightness|Насыщенность и яркость цвета/,
        }),
      ).toBeVisible();
      await expect(
        backgroundPanel.getByRole("button", { name: /^(Done|Готово)$/ }),
      ).toBeVisible();
      const beforeBackgroundPosts = await page.evaluate(
        () =>
          (
            window as unknown as { __mockInferencePosts: Array<{ type: string }> }
          ).__mockInferencePosts.filter((message) => message.type === "recomposite")
            .length,
      );
      const backgroundRevision = Number(
        await page.getByTestId("tool-workspace").getAttribute("data-document-revision"),
      );
      const backgroundPaintMs = await backgroundPanel
        .getByRole("button", { name: /^(Apply|Применить)$/ })
        .evaluate(
          (element) =>
            new Promise<number>((resolve) => {
              const startedAt = performance.now();
              (element as HTMLButtonElement).click();
              (element as HTMLButtonElement).click();
              requestAnimationFrame(() => resolve(performance.now() - startedAt));
            }),
        );
      expect(backgroundPaintMs).toBeLessThan(100);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as unknown as { __mockInferencePosts: Array<{ type: string }> }
              ).__mockInferencePosts.filter((message) => message.type === "recomposite")
                .length,
          ),
        )
        .toBe(beforeBackgroundPosts + 1);
      await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
        "data-document-revision",
        String(backgroundRevision + 1),
      );
      await page.getByRole("button", { name: /^(Enhancements|Улучшения)$/ }).click();
      await expect(page.getByTestId("canvas-view-controls")).toHaveCount(0);
      const enhancements = page.getByTestId("enhancements-tool-panel");
      await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
        "data-document-id",
        /edit-document-/,
      );
      const fineDetail = enhancements.getByRole("checkbox").first();
      await fineDetail.check();
      await page.evaluate(() => {
        (
          window as unknown as { __mockDelayMattingResponse?: boolean }
        ).__mockDelayMattingResponse = true;
      });
      const beforeRefinePosts = await page.evaluate(
        () =>
          (
            window as unknown as { __mockInferencePosts: Array<{ type: string }> }
          ).__mockInferencePosts.filter((message) => message.type === "refine").length,
      );
      const enhancementApply = enhancements.getByRole("button", {
        name: /^(Apply|Применить)$/,
      });
      await enhancementApply.evaluate((element) => {
        (
          window as unknown as { __phase32EnhancementPaint: Promise<number> }
        ).__phase32EnhancementPaint = new Promise<number>((resolve) => {
          element.addEventListener(
            "click",
            () => {
              const startedAt = performance.now();
              requestAnimationFrame(() => resolve(performance.now() - startedAt));
            },
            { once: true },
          );
        });
      });
      await enhancementApply.click();
      const enhancementPaintMs = await page.evaluate(
        () =>
          (window as unknown as { __phase32EnhancementPaint: Promise<number> })
            .__phase32EnhancementPaint,
      );
      expect(enhancementPaintMs).toBeLessThan(100);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as unknown as { __mockInferencePosts: Array<{ type: string }> }
              ).__mockInferencePosts.filter((message) => message.type === "refine")
                .length,
          ),
        )
        .toBe(beforeRefinePosts + 1);
      await enhancements.getByRole("button", { name: /^(Stop|Остановить)$/ }).click();
      await expect(fineDetail).toBeChecked();
      await expect(enhancements).toContainText(
        /No partial result was saved|Частичный результат не сохранён/,
      );
      await page.evaluate(() => {
        (
          window as unknown as { __mockDelayMattingResponse?: boolean }
        ).__mockDelayMattingResponse = false;
      });
      await page.getByRole("button", { name: /^(Cutout|Вырезание)$/ }).click();

      await expect(page.getByTestId("guided-brush-controls")).toBeVisible();
      await expect(page.getByTestId("canvas-view-controls")).toBeVisible();
      await expect(
        page.getByRole("slider", { name: /Brush size|Размер кисти/ }),
      ).toBeVisible();
    });
  }
}

test("Magic Apply is single-flight and yields the next paint within budget", async ({
  page,
}) => {
  await installMockInference(page);
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(mediumImage);
  const controls = page.getByTestId("guided-brush-controls");
  await expect(controls).toBeVisible({ timeout: 15_000 });
  await paintMagicStroke(page);
  const workspace = page.getByTestId("tool-workspace");
  const revision = Number(await workspace.getAttribute("data-document-revision"));
  const before = await page.evaluate(() => {
    const posts = (window as unknown as { __mockInferencePosts: Array<{ type: string }> })
      .__mockInferencePosts;
    return {
      prompt: posts.filter((message) => message.type === "prompt").length,
      recomposite: posts.filter((message) => message.type === "recomposite").length,
    };
  });
  const apply = controls.getByRole("button", { name: /^Apply$/ });
  await expect(apply).toBeEnabled();
  const nextPaintMs = await apply.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        const startedAt = performance.now();
        (element as HTMLButtonElement).click();
        (element as HTMLButtonElement).click();
        requestAnimationFrame(() => resolve(performance.now() - startedAt));
      }),
  );
  expect(nextPaintMs).toBeLessThan(100);
  await expect(workspace).toHaveAttribute("data-document-revision", String(revision + 1));
  const after = await page.evaluate(() => {
    const posts = (window as unknown as { __mockInferencePosts: Array<{ type: string }> })
      .__mockInferencePosts;
    return {
      prompt: posts.filter((message) => message.type === "prompt").length,
      recomposite: posts.filter((message) => message.type === "recomposite").length,
    };
  });
  expect(after.prompt - before.prompt).toBe(1);
  expect(after.recomposite - before.recomposite).toBe(1);
});

for (const locale of ["en", "ru"] as const) {
  test(`${locale}: batch add, safe error retry, and three-item edit cache stay isolated`, async ({
    page,
  }) => {
    await installMockInference(page);
    await page.addInitScript(() => {
      (
        window as unknown as { __mockBatchFailuresRemaining: number }
      ).__mockBatchFailuresRemaining = 1;
    });
    await page.goto(locale === "ru" ? "/" : "/en");
    const upload = page.getByLabel(/Upload an image|Загрузить изображения/);
    await expect(upload).toBeEnabled();
    await upload.setInputFiles([sampleImage, sampleImage, sampleImage]);

    const batch = page.getByTestId("batch-overview");
    await expect(batch.locator("article")).toHaveCount(3, { timeout: 15_000 });
    const failedTile = batch
      .locator("article")
      .filter({ hasText: /Failed|Ошибка/ })
      .first();
    await expect(failedTile).toBeVisible({ timeout: 15_000 });
    await failedTile.getByText(/Error details|Подробности ошибки/).click();
    await expect(failedTile).toContainText(
      /could not be processed locally|Не удалось обработать это изображение локально/,
    );
    await expect(failedTile).not.toContainText(/private\/mock\/path/);
    await failedTile.getByTestId("batch-item-actions").click();
    await page.getByRole("menuitem", { name: /Try again|Повторить/ }).click();
    await expect
      .poll(
        () =>
          batch
            .locator("article")
            .evaluateAll(
              (articles) =>
                articles.filter((article) =>
                  /Ready|Готово/.test(article.textContent ?? ""),
                ).length,
            ),
        { timeout: 15_000 },
      )
      .toBe(3);

    const addImages = page.getByLabel(/Add images|Добавить изображения/);
    await addImages.setInputFiles(sampleImage);
    await expect(batch.locator("article")).toHaveCount(4);
    await expect
      .poll(
        () =>
          batch
            .locator("article")
            .evaluateAll(
              (articles) =>
                articles.filter((article) =>
                  /Ready|Готово/.test(article.textContent ?? ""),
                ).length,
            ),
        { timeout: 15_000 },
      )
      .toBe(4);

    const tiles = batch.locator("article");
    await tiles.nth(0).locator("button").first().click();
    await page.getByRole("button", { name: /^(Background|Фон)$/ }).click();
    const background = page.getByTestId("background-tool-panel");
    await background.getByRole("button", { name: /Background color|Цвет фона/ }).click();
    const firstRevision = Number(
      await page.getByTestId("tool-workspace").getAttribute("data-document-revision"),
    );
    await background.getByRole("button", { name: /^(Apply|Применить)$/ }).click();
    await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
      "data-document-revision",
      String(firstRevision + 1),
    );
    const firstDocumentId = await page
      .getByTestId("tool-workspace")
      .getAttribute("data-document-id");

    await tiles.nth(1).locator("button").first().click();
    await expect(page.getByTestId("guided-brush-controls")).toBeVisible();
    await paintMagicStroke(page);
    const secondRevision = Number(
      await page.getByTestId("tool-workspace").getAttribute("data-document-revision"),
    );
    await page
      .getByTestId("guided-brush-controls")
      .getByRole("button", { name: /^(Apply|Применить)$/ })
      .click();
    await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
      "data-document-revision",
      String(secondRevision + 1),
    );
    const secondDocumentId = await page
      .getByTestId("tool-workspace")
      .getAttribute("data-document-id");

    await tiles.nth(2).locator("button").first().click();
    await page.getByRole("button", { name: /^(Enhancements|Улучшения)$/ }).click();
    const enhancements = page.getByTestId("enhancements-tool-panel");
    const thirdRevision = Number(
      await page.getByTestId("tool-workspace").getAttribute("data-document-revision"),
    );
    await enhancements.getByRole("button", { name: /^(Apply|Применить)$/ }).click();
    await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
      "data-document-revision",
      String(thirdRevision + 1),
    );
    const thirdDocumentId = await page
      .getByTestId("tool-workspace")
      .getAttribute("data-document-id");

    const automaticInferenceCounts = await page.evaluate(() => {
      const posts = (
        window as unknown as { __mockInferencePosts: Array<{ type: string }> }
      ).__mockInferencePosts;
      return {
        encode: posts.filter((message) => message.type === "encode").length,
        process: posts.filter((message) => message.type === "process").length,
      };
    });
    for (const [index, tool, documentId] of [
      [0, /^(Background|Фон)$/, firstDocumentId],
      [1, /^(Cutout|Вырезание)$/, secondDocumentId],
      [2, /^(Enhancements|Улучшения)$/, thirdDocumentId],
    ] as const) {
      await tiles.nth(index).locator("button").first().click();
      await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
        "data-document-id",
        documentId ?? "",
      );
      await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
        "data-document-revision",
        "1",
      );
      await expect(page.getByRole("button", { name: tool })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await tiles.nth(0).locator("button").first().click();
    await expect(
      page.getByTestId("background-tool-panel").getByRole("button", {
        name: /Background color|Цвет фона/,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    const automaticInferenceCountsAfterSelection = await page.evaluate(() => {
      const posts = (
        window as unknown as { __mockInferencePosts: Array<{ type: string }> }
      ).__mockInferencePosts;
      return {
        encode: posts.filter((message) => message.type === "encode").length,
        process: posts.filter((message) => message.type === "process").length,
      };
    });
    expect(automaticInferenceCountsAfterSelection).toEqual(automaticInferenceCounts);
  });
}
