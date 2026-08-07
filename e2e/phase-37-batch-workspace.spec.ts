import { readFile } from "node:fs/promises";

import { expect, test } from "./support/editor/fixtures";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("batch import stays FIFO while selection, drafts, failure, remove, and ZIP remain isolated", async ({
  editor,
  page,
}) => {
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  const input = page.getByLabel("Upload an image");
  await input.setInputFiles([
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
  ]);

  const strip = page.getByTestId("batch-overview");
  await expect(strip.locator("article")).toHaveCount(3);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await expect(strip).toContainText("Queue position 1");
  await editor.scenario.stage("automatic-remove");
  await editor.scenario.completeRun();
  await expect.poll(editor.scenario.runCount).toBe(2);
  await editor.scenario.stage("automatic-remove");
  await expect(strip.getByText("Processing locally")).toBeVisible();
  await editor.scenario.completeRun();
  await expect.poll(editor.scenario.runCount).toBe(3);
  await editor.scenario.stage("automatic-remove");
  await editor.scenario.completeRun();
  await expect(strip.getByText("Result ready")).toHaveCount(3);

  const second = strip.locator("article").nth(1);
  const selectSecond = second.getByRole("button", { name: /Select / });
  await selectSecond.click();
  await expect(selectSecond).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await expect(page.getByText("Background preview has unapplied changes.")).toBeVisible();

  const first = strip.locator("article").nth(0);
  await first.getByRole("button", { name: /Select / }).click();
  await expect(
    page.getByRole("button", { name: "Background", exact: true }),
  ).toBeVisible();
  await second.getByRole("button", { name: /Select / }).click();
  await expect(page.getByText("Background preview has unapplied changes.")).toBeVisible();
  expect(await editor.scenario.runCount()).toBe(3);

  const addInput = page.getByLabel("Add images");
  await addInput.setInputFiles("e2e/fixtures/unsupported.txt");
  await expect(strip.getByText("Failed", { exact: true })).toBeVisible();
  const failed = strip.locator("article").last();
  await failed.getByTestId("batch-item-actions").click();
  await page.getByRole("menuitem", { name: "Remove image" }).click();
  await expect(strip.locator("article")).toHaveCount(3);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download all/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("cutbg-results.zip");
  const archivePath = await download.path();
  if (archivePath === null) throw new Error("Downloaded ZIP path is unavailable");
  const archive = await readFile(archivePath);
  const text = archive.toString("utf8");
  expect(text).toContain("cutbg-result-01.png");
  expect(text).toContain("cutbg-result-02.png");
  expect(text).toContain("cutbg-result-03.png");
  expect(text).not.toContain("sample");
  await expect(page.getByText("ZIP includes 3; skips 0.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  while ((await strip.locator("article").count()) > 0) {
    await strip.locator("article").last().getByTestId("batch-item-actions").click();
    await page.getByRole("menuitem", { name: "Remove image" }).click();
  }
  await expect.poll(editor.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});

test("Russian batch controls keep keyboard selection and guarded removal accessible", async ({
  editor,
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await page
    .getByLabel("Загрузить изображения")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
  const strip = page.getByTestId("batch-overview");
  await editor.scenario.stage("automatic-remove");
  await editor.scenario.completeRun();
  await expect.poll(editor.scenario.runCount).toBe(2);
  await editor.scenario.stage("automatic-remove");
  await expect(strip.getByText("Локальная обработка")).toBeVisible();
  await editor.scenario.completeRun();
  const second = strip.locator("article").nth(1);
  const open = second.getByRole("button", { name: /Выбрать / });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(open).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Фон", exact: true }).click();
  await page.getByRole("button", { name: "Океан" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await second.getByTestId("batch-item-actions").click();
  await page.getByRole("menuitem", { name: "Удалить изображение" }).click();
  await expect(strip.locator("article")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await second.getByTestId("batch-item-actions").click();
  await page.getByRole("menuitem", { name: "Удалить изображение" }).click();
  await expect(strip.locator("article")).toHaveCount(1);
  await expect(
    strip
      .locator("article")
      .first()
      .getByRole("button", { name: /Выбрать / }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await editor.scenario.runCount()).toBe(2);
});
