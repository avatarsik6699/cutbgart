import { readFile } from "node:fs/promises";

import { expect, test } from "./support/v2/fixtures";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("batch import stays FIFO while selection, drafts, failure, remove, and ZIP remain isolated", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  const input = page.getByLabel("Choose an image");
  await input.setInputFiles([
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
    phase33ImageCorpus.smoke.path,
  ]);

  const strip = page.getByTestId("v2-workspace-strip");
  await expect(strip.locator("li")).toHaveCount(3);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
  await expect(strip).toContainText("Queue position 1");
  await editorV2.scenario.stage("automatic-remove");
  await editorV2.scenario.completeRun();
  await expect.poll(editorV2.scenario.runCount).toBe(2);
  await editorV2.scenario.stage("automatic-remove");
  await expect(strip.getByText("Processing locally")).toBeVisible();
  await editorV2.scenario.completeRun();
  await expect.poll(editorV2.scenario.runCount).toBe(3);
  await editorV2.scenario.stage("automatic-remove");
  await editorV2.scenario.completeRun();
  await expect(strip.getByText("Result ready")).toHaveCount(3);

  const second = strip.locator("li").nth(1);
  await second.getByRole("button", { name: /Open / }).click();
  await expect(second).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await expect(page.getByText("Background preview has unapplied changes.")).toBeVisible();

  const first = strip.locator("li").nth(0);
  await first.getByRole("button", { name: /Open / }).click();
  await expect(
    page.getByRole("button", { name: "Background", exact: true }),
  ).toBeVisible();
  await second.getByRole("button", { name: /Open / }).click();
  await expect(page.getByText("Background preview has unapplied changes.")).toBeVisible();
  expect(await editorV2.scenario.runCount()).toBe(3);

  const addInput = page.getByLabel("Add images");
  await addInput.setInputFiles("e2e/fixtures/unsupported.txt");
  await expect(strip.getByText("Needs attention")).toBeVisible();
  await strip.getByRole("button", { name: /Remove unsupported\.txt/ }).click();
  await expect(strip.locator("li")).toHaveCount(3);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
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
  while ((await strip.locator("li").count()) > 0)
    await strip
      .locator("li")
      .last()
      .getByRole("button", { name: /Remove / })
      .click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});

test("Russian batch controls keep keyboard selection and guarded removal accessible", async ({
  editorV2,
  page,
}) => {
  await page.goto("/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await page
    .getByLabel("Выбрать изображение")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
  const strip = page.getByTestId("v2-workspace-strip");
  await editorV2.scenario.stage("automatic-remove");
  await editorV2.scenario.completeRun();
  await expect.poll(editorV2.scenario.runCount).toBe(2);
  await editorV2.scenario.stage("automatic-remove");
  await expect(strip.getByText("Локальная обработка")).toBeVisible();
  await editorV2.scenario.completeRun();
  const second = strip.locator("li").nth(1);
  const open = second.getByRole("button", { name: /Открыть / });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Фон", exact: true }).click();
  await page.getByRole("button", { name: "Океан" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await second.getByRole("button", { name: /Удалить / }).click();
  await expect(strip.locator("li")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: /Удалить / }).click();
  await expect(strip.locator("li")).toHaveCount(1);
  await expect(strip.locator("li").first()).toHaveAttribute("aria-current", "true");
  expect(await editorV2.scenario.runCount()).toBe(2);
});
