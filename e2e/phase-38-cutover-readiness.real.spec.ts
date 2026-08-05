import { expect, test } from "@playwright/test";

import { phase33ImageCorpus } from "./support/v2/image-corpus";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

test("cold and warm real-model documents complete the accepted full workflow", async ({
  page,
}) => {
  test.setTimeout(25 * 60_000);
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __phase38AutomaticRuns?: number;
      __phase38MagicPredictions?: number;
      __phase38EnhancementRuns?: number;
    };
    testWindow.__phase38AutomaticRuns = 0;
    testWindow.__phase38MagicPredictions = 0;
    testWindow.__phase38EnhancementRuns = 0;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with Worker receiver.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      if (typeof message === "object" && message !== null && "type" in message) {
        if (message.type === "PREDICT")
          testWindow.__phase38MagicPredictions =
            (testWindow.__phase38MagicPredictions ?? 0) + 1;
        if (message.type === "RUN" && "correlation" in message) {
          const correlation = message.correlation;
          if (
            typeof correlation === "object" &&
            correlation !== null &&
            "operationId" in correlation
          )
            testWindow.__phase38EnhancementRuns =
              (testWindow.__phase38EnhancementRuns ?? 0) + 1;
          else
            testWindow.__phase38AutomaticRuns =
              (testWindow.__phase38AutomaticRuns ?? 0) + 1;
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
    .getByLabel("Choose an image")
    .setInputFiles([phase33ImageCorpus.smoke.path, phase33ImageCorpus.smoke.path]);
  const strip = page.getByTestId("v2-workspace-strip");
  await expect(strip.getByText("Result ready")).toHaveCount(2, {
    timeout: 12 * 60_000,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __phase38AutomaticRuns?: number })
            .__phase38AutomaticRuns ?? 0,
      ),
    )
    .toBe(2);

  await strip.locator("li").first().getByRole("button", { name: /Open / }).click();
  await page.getByRole("button", { name: "Manual cutout" }).click();
  await page
    .getByRole("img", { name: "Manual cutout canvas" })
    .click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await page.getByRole("button", { name: "Magic Cutout" }).click();
  const magicCanvas = page.getByLabel("Paint Keep and Remove guidance on the image");
  await magicCanvas.click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const enhancementsLauncher = page.getByRole("button", {
    name: "Enhancements",
    exact: true,
  });
  const noChange = page.getByText(/Nothing was added to document history/);
  await expect(enhancementsLauncher.or(noChange)).toBeVisible({ timeout: 8 * 60_000 });
  if (await noChange.isVisible())
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await strip.locator("li").nth(1).getByRole("button", { name: /Open / }).click();
  await expect(strip.locator("li").nth(1)).toHaveAttribute("aria-current", "true");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __phase38AutomaticRuns?: number }).__phase38AutomaticRuns ??
        0,
    ),
  ).toBe(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
  expect((await download).suggestedFilename()).toBe("cutbg-results.zip");
  const realToolRuns = await page.evaluate(() => ({
    magic: (window as Window & { __phase38MagicPredictions?: number })
      .__phase38MagicPredictions,
    enhancements: (window as Window & { __phase38EnhancementRuns?: number })
      .__phase38EnhancementRuns,
  }));
  expect(realToolRuns.magic).toBe(1);
  expect(realToolRuns.enhancements).toBeGreaterThan(0);

  while ((await strip.locator("li").count()) > 0)
    await strip
      .locator("li")
      .last()
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
