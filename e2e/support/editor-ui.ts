import { expect, type Locator, type Page } from "@playwright/test";

export async function expectAutomaticCutout(page: Page): Promise<Locator> {
  const stage = page.getByTestId("editor-stage");
  const panel = page.getByTestId("cutout-tool-panel");
  await expect(stage).toBeVisible({ timeout: 15_000 });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("guided-brush-selection")).toBeVisible({
    timeout: 15_000,
  });
  return panel;
}

export async function expectComparisonForTool(
  page: Page,
  toolName: string | RegExp,
): Promise<Locator> {
  await page
    .getByRole("button", { name: toolName, exact: typeof toolName === "string" })
    .click();
  const comparison = page.getByRole("slider", {
    name: /before\/after comparison|положение сравнения до и после/i,
  });
  await expect(comparison).toBeVisible();
  return comparison;
}

export async function applyMagicPass(page: Page): Promise<void> {
  const panel = await expectAutomaticCutout(page);
  const workspace = page.getByTestId("tool-workspace");
  const revisionBefore = Number(await workspace.getAttribute("data-document-revision"));
  await panel.getByRole("button", { name: /^(?:Remove|Удалить)$/ }).click();

  const image = page.getByRole("img", {
    name: /brush-guided object correction|коррекции объекта кистью/i,
  });
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Magic canvas has no bounding box");
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, {
    steps: 3,
  });
  await page.mouse.up();

  const apply = panel.getByRole("button", {
    name: /^(?:Apply|Применить)$/,
  });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(workspace).toHaveAttribute(
    "data-document-revision",
    String(revisionBefore + 1),
  );
}

export async function openManualCutout(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /^(?:Cutout|Вырезание)$/ }).click();
  const panel = page.getByTestId("cutout-tool-panel");
  await panel.getByRole("tab", { name: /^(?:Manual|Вручную)$/ }).click();
  const canvas = page.getByRole("img", {
    name: /mask correction canvas|холст коррекции/i,
  });
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  return canvas;
}
