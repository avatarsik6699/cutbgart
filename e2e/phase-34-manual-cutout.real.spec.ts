import { expect, test } from "@playwright/test";

import { exportComponent } from "./support/editor/export";
import { phase33ImageCorpus } from "./support/editor/image-corpus";
import { previewComponent } from "./support/editor/preview";
import { uploadComponent } from "./support/editor/upload";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

test("real model result accepts one Manual commit without re-running inference", async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __phase34InferenceRuns?: number;
      __phase34ManualCommits?: number;
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with Worker receiver.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      if (typeof message === "object" && message !== null && "type" in message) {
        if (message.type === "RUN") {
          testWindow.__phase34InferenceRuns =
            (testWindow.__phase34InferenceRuns ?? 0) + 1;
        }
        if (
          message.type === "MATERIALIZE_SNAPSHOT" &&
          "correlation" in message &&
          typeof message.correlation === "object" &&
          message.correlation !== null &&
          "operation" in message.correlation &&
          message.correlation.operation === "manual-cutout"
        ) {
          testWindow.__phase34ManualCommits =
            (testWindow.__phase34ManualCommits ?? 0) + 1;
        }
      }
      Reflect.apply(
        nativePostMessage,
        this,
        options === undefined ? [message] : [message, options],
      );
    };
  });

  const upload = uploadComponent(page);
  const preview = previewComponent(page);
  const exportPng = exportComponent(page);
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await upload.choose(phase33ImageCorpus.smoke.path);
  await expect(preview.image).toBeVisible({ timeout: 5 * 60_000 });
  await page.getByRole("button", { name: "Manual cutout" }).click();
  const canvas = page.getByRole("img", { name: "Manual cutout canvas" });
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("Manual canvas has no viewport box");
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        inference:
          (window as Window & { __phase34InferenceRuns?: number })
            .__phase34InferenceRuns ?? 0,
        manual:
          (window as Window & { __phase34ManualCommits?: number })
            .__phase34ManualCommits ?? 0,
      })),
    )
    .toEqual({ inference: 1, manual: 1 });
  expect((await exportPng.download()).suggestedFilename()).toBe("cutbg-result.png");
  await preview.resetButton.click();
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
