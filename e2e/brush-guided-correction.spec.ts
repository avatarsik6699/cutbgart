import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORTRAIT = path.join(ROOT, "public", "images", "document-photo-example.webp");
const LANDSCAPE = path.join(ROOT, "public", "og-image.png");

test.beforeEach(async ({ page }) => installMockInference(page));
test.describe.configure({ mode: "serial" });

type LocaleContract = {
  path: string;
  upload: string;
  magic: string;
  manual: string;
  keep: string;
  remove: string;
  size: string;
  undo: string;
  redo: string;
  clear: string;
  apply: string;
  cancel: string;
  documentUndo: RegExp;
  documentRedo: RegExp;
};

const locales: LocaleContract[] = [
  {
    path: "/en/",
    upload: "Upload an image",
    magic: "Magic",
    manual: "Manual",
    keep: "Keep",
    remove: "Remove",
    size: "Guided brush size",
    undo: "Undo marking",
    redo: "Redo marking",
    clear: "Clear markings",
    apply: "Apply",
    cancel: "Cancel",
    documentUndo: /^Undo:/,
    documentRedo: /^Redo:/,
  },
  {
    path: "/",
    upload: "Загрузить изображения",
    magic: "Магия",
    manual: "Вручную",
    keep: "Оставить",
    remove: "Удалить",
    size: "Размер управляемой кисти",
    undo: "Отменить отметку",
    redo: "Вернуть отметку",
    clear: "Очистить отметки",
    apply: "Применить",
    cancel: "Отмена",
    documentUndo: /^Отменить:/,
    documentRedo: /^Вернуть:/,
  },
];

async function openAutomaticCutout(
  page: Page,
  locale: LocaleContract,
  file = PORTRAIT,
): Promise<Locator> {
  await page.goto(locale.path);
  const upload = page.getByLabel(locale.upload);
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(file);
  const panel = page.getByTestId("cutout-tool-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("guided-brush-selection")).toBeVisible({
    timeout: 15_000,
  });
  return panel;
}

function postsOfType(page: Page, type: string): Promise<number> {
  return page.evaluate(
    (requestedType) =>
      (
        window as unknown as {
          __mockInferencePosts: Array<{ type: string }>;
        }
      ).__mockInferencePosts.filter((post) => post.type === requestedType).length,
    type,
  );
}

async function latestRecompositeDeltas(
  page: Page,
): Promise<{ matteLossCount: number; matteGainCount: number } | null> {
  return page.evaluate(() => {
    const posts = (
      window as unknown as {
        __mockInferencePosts: Array<{
          type: string;
          matteLossCount?: number;
          matteGainCount?: number;
        }>;
      }
    ).__mockInferencePosts;
    let recomposite: (typeof posts)[number] | undefined;
    for (let index = posts.length - 1; index >= 0; index -= 1)
      if (posts[index]?.type === "recomposite") {
        recomposite = posts[index];
        break;
      }
    return typeof recomposite?.matteLossCount === "number" &&
      typeof recomposite.matteGainCount === "number"
      ? {
          matteLossCount: recomposite.matteLossCount,
          matteGainCount: recomposite.matteGainCount,
        }
      : null;
  });
}

async function paintMagic(page: Page): Promise<void> {
  const image = page.getByRole("img", {
    name: /brush-guided object correction|коррекции объекта кистью/i,
  });
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Magic image has no bounding box");
  await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.42);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.58, {
    steps: 4,
  });
  await page.mouse.up();
}

for (const locale of locales) {
  test(`Cutout Magic is one explicit, repeatable editor (${locale.path})`, async ({
    page,
  }) => {
    const panel = await openAutomaticCutout(page, locale);
    const workspace = page.getByTestId("tool-workspace");
    const stage = page.getByTestId("guided-brush-selection");

    await expect(panel.getByRole("tab", { name: locale.magic })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(panel.getByRole("tab", { name: locale.manual })).toBeVisible();
    await expect(panel).not.toContainText(
      /Current result|Continue from this result|candidate|prompt|stroke limit|Текущий результат|Продолжить с этого результата|кандидат|лимит/i,
    );
    await expect(page.getByTestId("guided-brush-candidates")).toHaveCount(0);

    const size = panel.getByRole("slider", { name: locale.size });
    await size.focus();
    await size.press("End");
    const preview = page.getByTestId("brush-size-stage-preview");
    await expect(preview).toHaveAttribute("data-visible", "true");
    const ring = page.getByTestId("brush-size-stage-preview-ring");
    const image = page.getByRole("img", {
      name: /brush-guided object correction|коррекции объекта кистью/i,
    });
    const imageBox = await image.boundingBox();
    if (!imageBox) throw new Error("Magic image has no bounding box");
    await page.mouse.move(
      imageBox.x + imageBox.width / 2,
      imageBox.y + imageBox.height / 2,
    );
    await expect
      .poll(async () => {
        const [ringBox, cursorBox] = await Promise.all([
          ring.boundingBox(),
          page.getByTestId("guided-brush-cursor").boundingBox(),
        ]);
        return Math.abs((ringBox?.width ?? 0) - (cursorBox?.width ?? 0));
      })
      .toBeLessThan(3);

    await image.focus();
    await image.press("ControlOrMeta+=");
    await expect(stage).toHaveAttribute("data-zoom", "125");
    await size.focus();
    await size.press("ArrowLeft");
    await expect(preview).toHaveAttribute("data-visible", "true");

    await panel.getByRole("button", { name: locale.remove, exact: true }).click();
    await paintMagic(page);
    await expect(stage).toHaveAttribute("data-stroke-count", "1");
    await panel.getByRole("button", { name: locale.undo }).click();
    await expect(stage).toHaveAttribute("data-stroke-count", "0");
    await panel.getByRole("button", { name: locale.redo }).click();
    await expect(stage).toHaveAttribute("data-stroke-count", "1");
    await panel.getByRole("button", { name: locale.clear }).click();
    await expect(stage).toHaveAttribute("data-stroke-count", "0");

    const apply = panel.getByRole("button", { name: locale.apply, exact: true });
    await paintMagic(page);
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(workspace).toHaveAttribute("data-document-revision", "1");
    await expect(stage).toHaveAttribute("data-stroke-count", "0");
    expect(await postsOfType(page, "prompt")).toBe(1);
    expect(await postsOfType(page, "recomposite")).toBe(1);

    await paintMagic(page);
    await apply.click();
    await expect(workspace).toHaveAttribute("data-document-revision", "2");
    expect(await postsOfType(page, "prompt")).toBe(2);
    expect(await postsOfType(page, "recomposite")).toBe(2);

    await paintMagic(page);
    await panel.getByRole("button", { name: locale.undo }).click();
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(stage).toHaveAttribute("data-stroke-count", "0");
    await page.waitForTimeout(100);
    expect(await postsOfType(page, "prompt")).toBe(2);
    expect(await postsOfType(page, "recomposite")).toBe(2);
    await expect(workspace).toHaveAttribute("data-document-revision", "2");

    await paintMagic(page);
    await panel.getByRole("button", { name: locale.cancel, exact: true }).click();
    await expect(stage).toHaveAttribute("data-stroke-count", "0");
    await expect(workspace).toHaveAttribute("data-document-revision", "2");

    await page.getByRole("button", { name: locale.documentUndo }).click();
    await expect(workspace).toHaveAttribute("data-document-revision", "3");
    await page.getByRole("button", { name: locale.documentRedo }).click();
    await expect(workspace).toHaveAttribute("data-document-revision", "4");
  });
}

test("Keep restores the marked fragment without accepting destructive candidate holes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as unknown as { __mockDestructiveGuidedCandidate: boolean }
    ).__mockDestructiveGuidedCandidate = true;
  });
  const panel = await openAutomaticCutout(page, locales[0]!);
  await paintMagic(page);
  await panel.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByTestId("tool-workspace")).toHaveAttribute(
    "data-document-revision",
    "1",
  );
  await expect
    .poll(() => latestRecompositeDeltas(page))
    .toEqual({ matteLossCount: 0, matteGainCount: 25 });
});

test("two completed batch documents guard drafts and keep Apply/history isolated", async ({
  page,
}) => {
  await page.goto("/en/");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles([PORTRAIT, LANDSCAPE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done", {
    timeout: 15_000,
  });

  const itemButtons = page.getByRole("button", { name: /Select .* for review/i });
  await expect(itemButtons).toHaveCount(2);
  await itemButtons.first().click();
  const workspace = page.getByTestId("tool-workspace");
  const firstId = await workspace.getAttribute("data-document-id");
  await expect(page.getByTestId("guided-brush-selection")).toBeVisible({
    timeout: 15_000,
  });

  await paintMagic(page);
  await itemButtons.nth(1).click();
  await expect(page.getByTestId("editor-draft-guard")).toBeVisible();
  await expect(workspace).toHaveAttribute("data-document-id", firstId!);
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(workspace).not.toHaveAttribute("data-document-id", firstId!);
  const secondId = await workspace.getAttribute("data-document-id");

  await expect(page.getByTestId("guided-brush-selection")).toBeVisible({
    timeout: 15_000,
  });
  await paintMagic(page);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "1");

  await page.getByRole("tab", { name: "Manual" }).click();
  const manualCanvas = page.getByRole("img", { name: /mask correction canvas/i });
  await expect(manualCanvas).toBeVisible();
  const manualBox = await manualCanvas.boundingBox();
  if (!manualBox) throw new Error("Manual canvas has no bounding box");
  await page.mouse.click(
    manualBox.x + manualBox.width / 2,
    manualBox.y + manualBox.height / 2,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "1");

  await itemButtons.first().click();
  await expect(workspace).toHaveAttribute("data-document-id", firstId!);
  await expect(workspace).toHaveAttribute("data-document-revision", "0");
  await expect(page.getByTestId("guided-brush-selection")).toBeVisible({
    timeout: 15_000,
  });
  await paintMagic(page);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "1");
  await page.getByRole("button", { name: /^Undo:/ }).click();
  await expect(workspace).toHaveAttribute("data-document-revision", "2");

  await itemButtons.nth(1).click();
  await expect(workspace).toHaveAttribute("data-document-id", secondId!);
  await expect(workspace).toHaveAttribute("data-document-revision", "1");
});
