import { expect, test } from "@playwright/test";

import { phase33ImageCorpus } from "./support/editor/image-corpus";
import { previewComponent } from "./support/editor/preview";
import { uploadComponent } from "./support/editor/upload";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

test("real SlimSAM supports warm re-prediction and one explicit Magic Apply", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await page.addInitScript(() => {
    const counters = window as Window & {
      __phase35AutomaticRuns?: number;
      __phase35MagicCommits?: number;
      __phase35MagicPredictions?: number;
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with Worker receiver.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      if (typeof message === "object" && message !== null && "type" in message) {
        if (message.type === "RUN") {
          counters.__phase35AutomaticRuns = (counters.__phase35AutomaticRuns ?? 0) + 1;
        }
        if (message.type === "PREDICT") {
          counters.__phase35MagicPredictions =
            (counters.__phase35MagicPredictions ?? 0) + 1;
        }
        if (
          message.type === "MATERIALIZE_SNAPSHOT" &&
          "correlation" in message &&
          typeof message.correlation === "object" &&
          message.correlation !== null &&
          "operation" in message.correlation &&
          message.correlation.operation === "magic-cutout"
        ) {
          counters.__phase35MagicCommits = (counters.__phase35MagicCommits ?? 0) + 1;
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
  await page.goto("/en/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await upload.choose(phase33ImageCorpus.smoke.path);
  await expect(preview.image).toBeVisible({ timeout: 5 * 60_000 });
  await page.getByRole("button", { name: "Magic Cutout" }).click();
  const canvas = page.getByLabel("Paint Keep and Remove guidance on the image");
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("Magic canvas has no viewport box");
  const centre = { x: box.width / 2, y: box.height / 2 };
  await canvas.click({ position: centre });
  await page.getByRole("button", { name: "Remove" }).click();
  await canvas.click({ position: centre });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo edit" })).toBeEnabled({
    timeout: 5 * 60_000,
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const counters = window as Window & {
          __phase35AutomaticRuns?: number;
          __phase35MagicCommits?: number;
          __phase35MagicPredictions?: number;
        };
        return {
          automatic: counters.__phase35AutomaticRuns ?? 0,
          commits: counters.__phase35MagicCommits ?? 0,
          predictions: counters.__phase35MagicPredictions ?? 0,
        };
      }),
    )
    .toEqual({ automatic: 1, commits: 1, predictions: 1 });
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
