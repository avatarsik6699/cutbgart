import { expect, test } from "@playwright/test";

import { phase33ImageCorpus } from "./support/editor/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

test("three real documents share one FIFO model runtime and cached selection", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  await page.addInitScript(() => {
    const testWindow = window as Window & { __phase37AutomaticRuns?: number };
    testWindow.__phase37AutomaticRuns = 0;
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
        testWindow.__phase37AutomaticRuns = (testWindow.__phase37AutomaticRuns ?? 0) + 1;
      Reflect.apply(
        nativePostMessage,
        this,
        options === undefined ? [message] : [message, options],
      );
    };
  });
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await page
    .getByLabel("Choose an image")
    .setInputFiles([
      phase33ImageCorpus.representative.path,
      phase33ImageCorpus.smoke.path,
      phase33ImageCorpus.smoke.path,
    ]);
  const strip = page.getByTestId("batch-filmstrip");
  await expect(strip.locator("li")).toHaveCount(3);
  await expect(strip.getByText("Result ready")).toHaveCount(3, {
    timeout: 18 * 60_000,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __phase37AutomaticRuns?: number })
            .__phase37AutomaticRuns ?? 0,
      ),
    )
    .toBe(3);
  const resourcesBefore = await page.locator("main").evaluate((element) => ({
    artifacts: element.getAttribute("data-artifact-count"),
    objectUrls: element.getAttribute("data-object-url-count"),
  }));
  for (const item of await strip.locator("li").all()) {
    await item.getByRole("button", { name: /Open / }).click();
    await expect(item).toHaveAttribute("aria-current", "true");
  }
  expect(
    await page.locator("main").evaluate((element) => ({
      artifacts: element.getAttribute("data-artifact-count"),
      objectUrls: element.getAttribute("data-object-url-count"),
    })),
  ).toEqual(resourcesBefore);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __phase37AutomaticRuns?: number }).__phase37AutomaticRuns ??
        0,
    ),
  ).toBe(3);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
  expect((await download).suggestedFilename()).toBe("cutbg-results.zip");
  await strip
    .locator("li")
    .last()
    .getByRole("button", { name: /Remove / })
    .click();
  await expect(strip.locator("li")).toHaveCount(2);
  await page.getByRole("button", { name: "Start over" }).click();
  await strip
    .locator("li")
    .first()
    .getByRole("button", { name: /Remove / })
    .click();
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
