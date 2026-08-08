import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const UNSUPPORTED_FILE = path.join(TEST_DIRECTORY, "fixtures", "unsupported.txt");

type Phase43Counters = {
  automatic: number;
  backgroundCommits: number;
  enhancementRuns: number;
  magicCommits: number;
  magicPredictions: number;
  manualCommits: number;
};

async function counters(page: Page): Promise<Phase43Counters> {
  return page.evaluate(() => {
    const testWindow = window as Window & { __phase43Counters?: Phase43Counters };
    return (
      testWindow.__phase43Counters ?? {
        automatic: 0,
        backgroundCommits: 0,
        enhancementRuns: 0,
        magicCommits: 0,
        magicPredictions: 0,
        manualCommits: 0,
      }
    );
  });
}

test("serialized real model covers cold and warm complete-product work without reinference", async ({
  page,
}) => {
  test.setTimeout(25 * 60_000);
  await page.addInitScript(() => {
    function asRecord(value: unknown): Record<string, unknown> | null {
      return typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : null;
    }
    function recordRun(
      counters: Phase43Counters,
      message: Record<string, unknown>,
    ): void {
      const correlation = asRecord(message.correlation);
      if (correlation !== null && "operationId" in correlation)
        counters.enhancementRuns += 1;
      else counters.automatic += 1;
    }
    function recordSnapshotCommit(
      counters: Phase43Counters,
      message: Record<string, unknown>,
    ): void {
      const operation = asRecord(message.correlation)?.operation;
      if (operation === "magic-cutout") counters.magicCommits += 1;
      if (operation === "manual-cutout") counters.manualCommits += 1;
      if (operation === "background") counters.backgroundCommits += 1;
    }
    function recordWorkerMessage(counters: Phase43Counters, value: unknown): void {
      const message = asRecord(value);
      if (message === null) return;
      if (message.type === "RUN") recordRun(counters, message);
      if (message.type === "PREDICT") counters.magicPredictions += 1;
      if (message.type === "MATERIALIZE_SNAPSHOT")
        recordSnapshotCommit(counters, message);
    }
    const testWindow = window as Window & { __phase43Counters?: Phase43Counters };
    testWindow.__phase43Counters = {
      automatic: 0,
      backgroundCommits: 0,
      enhancementRuns: 0,
      magicCommits: 0,
      magicPredictions: 0,
      manualCommits: 0,
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with Worker receiver.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      const current = testWindow.__phase43Counters!;
      recordWorkerMessage(current, message);
      Reflect.apply(
        nativePostMessage,
        this,
        options === undefined ? [message] : [message, options],
      );
    };
  });

  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

  await page.getByLabel("Upload an image").setInputFiles(UNSUPPORTED_FILE);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("radio", { name: /^Maximum/ }).click();

  await page
    .getByLabel("Upload an image")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
  const batch = page.getByTestId("batch-overview");
  await expect(batch.getByText("Ready", { exact: true })).toHaveCount(2, {
    timeout: 12 * 60_000,
  });
  await expect.poll(async () => (await counters(page)).automatic).toBe(2);

  const firstItem = batch
    .locator("article")
    .first()
    .getByRole("button", { name: /Select / });
  const secondItem = batch
    .locator("article")
    .nth(1)
    .getByRole("button", { name: /Select / });
  await firstItem.click();

  const magicCanvas = page.getByLabel("Paint Keep and Remove guidance on the image");
  const magicBox = await magicCanvas.boundingBox();
  if (magicBox === null) throw new Error("Magic canvas has no viewport box");
  await magicCanvas.click({
    position: { x: magicBox.width / 2, y: magicBox.height / 2 },
  });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect
    .poll(async () => (await counters(page)).magicCommits, { timeout: 5 * 60_000 })
    .toBe(1);
  await expect.poll(async () => (await counters(page)).magicPredictions).toBe(1);

  await page.getByRole("tab", { name: "Manual", exact: true }).click();
  const manualCanvas = page.getByRole("img", { name: "Manual cutout canvas" });
  const manualBox = await manualCanvas.boundingBox();
  if (manualBox === null) throw new Error("Manual canvas has no viewport box");
  await manualCanvas.click({
    position: { x: manualBox.width / 2, y: manualBox.height / 2 },
  });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(async () => (await counters(page)).manualCommits).toBe(1);

  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page.getByRole("button", { name: "Ocean", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(async () => (await counters(page)).backgroundCommits).toBe(1);

  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(async () => (await counters(page)).enhancementRuns).toBe(2);
  await expect(
    page
      .getByText("Document revision 5")
      .or(page.getByText(/No safe visible change was needed/)),
  ).toBeVisible({ timeout: 8 * 60_000 });

  await page.getByRole("button", { name: "Undo document change" }).click();
  await page.getByRole("button", { name: "Redo document change" }).click();
  await secondItem.click();
  await expect(secondItem).toHaveAttribute("aria-pressed", "true");

  const selectedPng = page.waitForEvent("download");
  await batch.locator("article").nth(1).getByTestId("batch-item-actions").click();
  await page.getByRole("menuitem", { name: "Download PNG" }).click();
  expect((await selectedPng).suggestedFilename()).toBe("cutbg-result.png");

  const zip = page.waitForEvent("download");
  await page.getByRole("button", { name: "Output options" }).click();
  await page.getByRole("menuitem", { name: /Download all/ }).click();
  expect((await zip).suggestedFilename()).toBe("cutbg-results.zip");
  expect((await counters(page)).automatic).toBe(2);

  await page.getByRole("button", { name: "Back to upload" }).click();
  await expect
    .poll(() =>
      page.locator("main").evaluate((element) => ({
        artifacts: Number(element.getAttribute("data-artifact-count")),
        leases: Number(element.getAttribute("data-lease-count")),
        objectUrls: Number(element.getAttribute("data-object-url-count")),
      })),
    )
    .toEqual({ artifacts: 0, leases: 0, objectUrls: 0 });
});
