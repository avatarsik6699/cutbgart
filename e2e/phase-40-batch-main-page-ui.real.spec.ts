import { expect, test } from "@playwright/test";

import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

test("phase 40 real batch: FIFO results, responsive selection, PNG and ZIP without reinference", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  await page.addInitScript(() => {
    const testWindow = window as Window & { __phase40AutomaticRuns?: number };
    testWindow.__phase40AutomaticRuns = 0;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with Worker receiver.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "RUN" &&
        "correlation" in message &&
        typeof message.correlation === "object" &&
        message.correlation !== null &&
        !("operationId" in message.correlation)
      )
        testWindow.__phase40AutomaticRuns = (testWindow.__phase40AutomaticRuns ?? 0) + 1;
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
  const rail = page.getByTestId("batch-overview");
  await expect(rail.locator("article")).toHaveCount(2);
  await expect(rail.getByText("Ready", { exact: true })).toHaveCount(2, {
    timeout: 18 * 60_000,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __phase40AutomaticRuns?: number })
            .__phase40AutomaticRuns ?? 0,
      ),
    )
    .toBe(2);

  const second = rail
    .locator("article")
    .nth(1)
    .getByRole("button", { name: /Select / });
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  const selectedPng = page.waitForEvent("download");
  await rail.locator("article").nth(1).getByTestId("batch-item-actions").click();
  await page.getByRole("menuitem", { name: "Download PNG" }).click();
  expect((await selectedPng).suggestedFilename()).toBe("cutbg-result.png");

  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download all/ }).click();
  expect((await zipPromise).suggestedFilename()).toBe("cutbg-results.zip");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __phase40AutomaticRuns?: number }).__phase40AutomaticRuns ??
        0,
    ),
  ).toBe(2);
});
