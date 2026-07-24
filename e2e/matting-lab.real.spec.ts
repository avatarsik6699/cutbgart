import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("real matting lab: pinned ViTMatte browser matrix", async ({ page }) => {
  test.setTimeout(40 * 60 * 1000);
  await page.goto("/dev/model-lab");
  await expect(page.getByTestId("model-lab")).toBeVisible();
  await expect(page.getByTestId("model-lab-capabilities")).not.toContainText(
    "определяется",
  );
  await page.getByTestId("matting-opt-in").check();
  await expect(page.getByTestId("matting-opt-in")).toBeChecked();
  await page.getByTestId("load-matting-corpus").click();
  await expect(page.getByText(/Корпус: 8 случаев/)).toBeVisible();
  await page.getByTestId("run-matting-lab").click();
  await expect(page.getByTestId("matting-lab-progress")).toContainText(
    "complete · 32/32",
    { timeout: 38 * 60 * 1000 },
  );

  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByTestId("matting-lab-export").click();
  const download = await downloadPromise;
  const report = JSON.parse(await readFile(await download.path(), "utf8")) as {
    schemaVersion: number;
    corpusCaseCount: number;
    runtime: Array<{ status: string; actualPath: string; errorCode?: string }>;
    quality: unknown[];
  };
  expect(report.schemaVersion).toBe(2);
  expect(report.corpusCaseCount).toBe(8);
  expect(report.runtime).toHaveLength(32);
  expect(report.quality.length).toBeLessThanOrEqual(32);
  console.log(`[matting-lab-real] ${JSON.stringify(report, null, 2)}`);
});
