import { expect, test, type Page } from "@playwright/test";

import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

type Phase41Counters = {
  automatic: number;
  backgroundCommits: number;
  enhancementRuns: number;
  magicCommits: number;
  magicPredictions: number;
  manualCommits: number;
};

async function counters(page: Page): Promise<Phase41Counters> {
  return page.evaluate(() => {
    const testWindow = window as Window & { __phase41Counters?: Phase41Counters };
    return (
      testWindow.__phase41Counters ?? {
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

test("real v1-faithful editor completes every v2 tool without automatic reinference", async ({
  page,
}) => {
  test.setTimeout(25 * 60_000);
  await page.addInitScript(() => {
    const testWindow = window as Window & { __phase41Counters?: Phase41Counters };
    testWindow.__phase41Counters = {
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
      const current = testWindow.__phase41Counters!;
      if (typeof message === "object" && message !== null && "type" in message) {
        if (message.type === "RUN" && "correlation" in message) {
          const correlation = message.correlation;
          if (
            typeof correlation === "object" &&
            correlation !== null &&
            "operationId" in correlation
          )
            current.enhancementRuns += 1;
          else current.automatic += 1;
        }
        if (message.type === "PREDICT") current.magicPredictions += 1;
        if (
          message.type === "MATERIALIZE_SNAPSHOT" &&
          "correlation" in message &&
          typeof message.correlation === "object" &&
          message.correlation !== null &&
          "operation" in message.correlation
        ) {
          if (message.correlation.operation === "magic-cutout") current.magicCommits += 1;
          if (message.correlation.operation === "manual-cutout")
            current.manualCommits += 1;
          if (message.correlation.operation === "background")
            current.backgroundCommits += 1;
        }
      }
      Reflect.apply(
        nativePostMessage,
        this,
        options === undefined ? [message] : [message, options],
      );
    };
  });

  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
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

  await secondItem.click();
  await expect(secondItem).toHaveAttribute("aria-pressed", "true");
  await firstItem.click();
  await expect(firstItem).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Undo document change" }).click();
  await page.getByRole("button", { name: "Redo document change" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("cutbg-result.png");
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
