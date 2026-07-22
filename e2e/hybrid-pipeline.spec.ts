import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.beforeEach(async ({ page }) => installMockInference(page));

const locales = [
  {
    path: "/en",
    upload: "Upload an image",
    refine: /^Refine edges$/,
    refineAgain: /^Refine again$/,
    clean: /^Clean edge colours$/,
    cleanAgain: /^Clean again$/,
    brush: /Skip and edit with brush/,
    editor: /mask correction editor/i,
    done: /^Done$/,
    ocean: "Ocean",
    save: /^Save background$/,
    download: /^Download$/,
    another: /Process another image/,
  },
  {
    path: "/",
    upload: "Загрузить изображения",
    refine: /^Уточнить края$/,
    refineAgain: /^Уточнить ещё раз$/,
    clean: /^Очистить цвет краёв$/,
    cleanAgain: /^Очистить ещё раз$/,
    brush: /Пропустить и править кистью/,
    editor: /редактор маски/i,
    done: /^Готово$/,
    ocean: "Океан",
    save: /^Сохранить фон$/,
    download: /^Скачать$/,
    another: /Обработать другое изображение/,
  },
] as const;

async function paintCenter(page: Page): Promise<void> {
  const canvas = page.getByRole("img", {
    name: /mask correction canvas|холст коррекции/i,
  });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Mask correction canvas has no bounding box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

for (const locale of locales) {
  test(`full hybrid pipeline remains composable (${locale.path})`, async ({ page }) => {
    await page.goto(locale.path);
    const upload = page.getByLabel(locale.upload);
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(SAMPLE);
    await expect(
      page.getByRole("slider", { name: /before\/after|до и после/i }),
    ).toBeVisible();

    const matte = page.getByTestId("matte-refinement-controls");
    await matte.getByRole("button", { name: locale.refine }).click();
    await expect(matte.getByRole("button", { name: locale.refineAgain })).toBeVisible();

    const foreground = page.getByTestId("foreground-refinement-controls");
    await foreground.getByRole("button", { name: locale.clean }).click();
    await expect(
      foreground.getByRole("button", { name: locale.cleanAgain }),
    ).toBeVisible();
    await foreground.getByRole("button", { name: locale.brush }).click();
    await expect(page.getByRole("application", { name: locale.editor })).toBeVisible();
    await paintCenter(page);
    await page.getByRole("button", { name: locale.done }).click();

    await page.getByRole("button", { name: locale.ocean }).click();
    const save = page.getByRole("button", { name: locale.save });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();

    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: locale.download }).click();
    expect((await downloaded).suggestedFilename()).toBe("result.png");
    await page.getByRole("button", { name: locale.another }).click();
    await expect(page.getByLabel(locale.upload)).toBeAttached();
  });
}
