import { readFile } from "node:fs/promises";

import { expect, test } from "./support/editor/fixtures";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ retries: 0 });

test("mocked Chromium critical path: public single and batch edit, history, and export", async ({
  editor,
  page,
}) => {
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

  await editor.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editor.scenario.runCount).toBe(1);
  await editor.scenario.completeRun();
  await page.getByRole("tab", { name: "Manual" }).click();
  await page
    .getByRole("img", { name: "Manual cutout canvas" })
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "Undo document change" })).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo document change" })).toBeEnabled();
  await page.keyboard.press("Control+y");
  expect((await editor.exportPng.download()).suggestedFilename()).toBe(
    "cutbg-result.png",
  );

  await editor.preview.resetButton.click();
  await page
    .getByLabel("Upload an image")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
  await expect.poll(editor.scenario.runCount).toBe(2);
  await editor.scenario.completeRun();
  await expect.poll(editor.scenario.runCount).toBe(3);
  await editor.scenario.completeRun();
  await expect(page.getByTestId("batch-overview").getByText("Result ready")).toHaveCount(
    2,
  );

  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download all/ }).click();
  const archive = await pending;
  expect(archive.suggestedFilename()).toBe("cutbg-results.zip");
  const archivePath = await archive.path();
  if (archivePath === null) throw new Error("Downloaded ZIP path is unavailable");
  expect((await readFile(archivePath)).toString("utf8")).toContain("cutbg-result-01.png");
});
