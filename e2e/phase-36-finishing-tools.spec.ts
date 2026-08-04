import { expect, test } from "./support/v2/fixtures";
import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ retries: 0 });
test.use({ trace: "retain-on-failure" });

test("Background and Enhancements remain explicit atomic document edits", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
  await editorV2.scenario.completeRun();

  await page.getByRole("button", { name: "Background", exact: true }).click();
  await expect(page.getByRole("region", { name: "Background" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Download", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ocean" }).click();
  await expect(page.getByText("Background preview has unapplied changes.")).toBeVisible();
  expect((await editorV2.exportPng.download()).suggestedFilename()).toBe(
    "cutbg-result.png",
  );
  await expect(page.getByText("Document revision 1")).toBeVisible();
  await expect.poll(editorV2.scenario.backgroundCommitCount).toBe(0);

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Background", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Document revision 2")).toBeVisible();
  await expect.poll(editorV2.scenario.backgroundCommitCount).toBe(1);

  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Redo document change" })).toBeEnabled();
  await page.keyboard.press("Control+y");
  await expect(page.getByRole("button", { name: "Undo document change" })).toBeEnabled();

  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await expect(page.getByTestId("tool-panel-slot")).toBeFocused();
  await expect(
    page.getByRole("checkbox", { name: /Improve fine details/ }),
  ).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Remove colour halo/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(0);

  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(1);
  await page.keyboard.press("Control+Enter");
  expect(await editorV2.scenario.enhancementRunCount()).toBe(1);
  await expect(page.getByRole("status")).toContainText("Improve fine details · 50%");
  await editorV2.scenario.completeEnhancement();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(2);
  await expect(page.getByRole("status")).toContainText("Remove colour halo · 50%");
  await editorV2.scenario.completeEnhancement();
  await expect(page.getByText("Document revision 5")).toBeVisible();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(2);
  await expect.poll(editorV2.scenario.enhancementCommitCount).toBe(1);
  await expect.poll(editorV2.scenario.runCount).toBe(1);

  expect((await editorV2.exportPng.download()).suggestedFilename()).toBe(
    "cutbg-result.png",
  );
  await editorV2.preview.resetButton.click();
  await expect.poll(editorV2.scenario.resourceCounts).toEqual({
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
});

test("Enhancement no-op, failure retry, and cancelled stale terminal stay atomic", async ({
  editorV2,
  page,
}) => {
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
  await editorV2.scenario.completeRun();

  await editorV2.scenario.setEnhancementOutcome("unchanged");
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(1);
  await editorV2.scenario.completeEnhancement();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(2);
  await editorV2.scenario.completeEnhancement();
  await expect(page.getByText(/No safe visible change was needed/)).toBeVisible();
  await expect(page.getByText("Document revision 1")).toBeVisible();
  await expect.poll(editorV2.scenario.enhancementCommitCount).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await editorV2.scenario.setEnhancementOutcome("failed");
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(3);
  await editorV2.scenario.completeEnhancement();
  await expect(page.getByText(/Enhancements could not be completed/)).toBeVisible();
  await expect(page.getByText("Document revision 1")).toBeVisible();
  await expect.poll(editorV2.scenario.enhancementCommitCount).toBe(0);

  await editorV2.scenario.setEnhancementOutcome("changed");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(4);
  await editorV2.scenario.completeEnhancement();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(5);
  await editorV2.scenario.completeEnhancement();
  await expect(page.getByText("Document revision 2")).toBeVisible();
  await expect.poll(editorV2.scenario.enhancementCommitCount).toBe(1);

  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(editorV2.scenario.enhancementRunCount).toBe(6);
  await page.keyboard.press("Escape");
  await editorV2.scenario.completeEnhancement();
  await expect(
    page.getByRole("button", { name: "Enhancements", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Document revision 2")).toBeVisible();
  await expect.poll(editorV2.scenario.enhancementCommitCount).toBe(1);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
});

test("custom Background validation and finishing controls are localized in Russian", async ({
  editorV2,
  page,
}) => {
  await page.goto("/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await editorV2.upload.choose(phase33ImageCorpus.smoke.path);
  await expect.poll(editorV2.scenario.runCount).toBe(1);
  await editorV2.scenario.completeRun();

  await page.getByRole("button", { name: "Фон", exact: true }).click();
  const input = page.getByLabel("Выбрать изображение для фона");
  await input.setInputFiles("e2e/fixtures/unsupported.txt");
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось подготовить изображение фона",
  );
  await expect.poll(editorV2.scenario.backgroundPreparationCount).toBe(0);
  await page.getByRole("button", { name: "Отмена", exact: true }).click();

  await page.getByRole("button", { name: "Фон", exact: true }).click();
  await page
    .getByLabel("Выбрать изображение для фона")
    .setInputFiles(phase33ImageCorpus.smoke.path);
  await expect.poll(editorV2.scenario.backgroundPreparationCount).toBe(1);
  await expect(
    page.getByText("В предпросмотре фона есть неприменённые изменения."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Улучшения", exact: true }),
  ).toBeVisible();
  await expect.poll(editorV2.scenario.backgroundCommitCount).toBe(0);
});
