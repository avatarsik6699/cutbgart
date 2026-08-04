import { expect, test } from "@playwright/test";

import { phase33ImageCorpus } from "./support/v2/image-corpus";
import { uploadComponent } from "./support/v2/upload";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

test("phase 39 real main page: selected model, result, resized export", async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  await page.addInitScript(() => {
    const testWindow = window as Window & { __phase39RealRunCount?: number };
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
        message.type === "RUN"
      ) {
        testWindow.__phase39RealRunCount = (testWindow.__phase39RealRunCount ?? 0) + 1;
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
  await page.getByRole("radio", { name: /^Maximum/ }).click();
  await uploadComponent(page).choose(phase33ImageCorpus.smoke.path);
  await expect(page.getByTestId("before-after-frame")).toBeVisible({
    timeout: 5 * 60_000,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __phase39RealRunCount?: number }).__phase39RealRunCount ??
          0,
      ),
    )
    .toBe(1);

  await page.getByRole("button", { name: "Output options", exact: true }).click();
  const compactOption = page.getByRole("menuitemradio", { name: "1024 px" });
  if (await compactOption.isVisible()) await compactOption.click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByTestId("download-split-button")
    .getByRole("button", { name: "Download", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^cutbg-result(?:-1024)?\.png$/,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __phase39RealRunCount?: number }).__phase39RealRunCount ??
          0,
      ),
    )
    .toBe(1);
});
