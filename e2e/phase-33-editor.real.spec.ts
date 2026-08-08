import { expect, test } from "@playwright/test";

import { exportComponent } from "./support/editor/export";
import { phase33ImageCorpus } from "./support/editor/image-corpus";
import { previewComponent } from "./support/editor/preview";
import { uploadComponent } from "./support/editor/upload";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

test("editor real boundary: one model run, preview, and export", async ({
  context,
  page,
}) => {
  test.setTimeout(6 * 60_000);
  const modelResources = new Set<string>();
  context.on("request", (request) => {
    if (
      /cdn\.cutbg\.art|huggingface|onnxruntime|\.(?:onnx|wasm)(?:\?|$)/i.test(
        request.url(),
      )
    ) {
      modelResources.add(request.url());
    }
  });
  await page.addInitScript(() => {
    const testWindow = window as Window & { __phase33RealRunCount?: number };
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
        testWindow.__phase33RealRunCount = (testWindow.__phase33RealRunCount ?? 0) + 1;
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
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __phase33RealRunCount?: number }).__phase33RealRunCount ??
          0,
      ),
    )
    .toBe(1);
  expect((await exportPng.download()).suggestedFilename()).toBe("cutbg-result.png");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __phase33RealRunCount?: number }).__phase33RealRunCount ??
          0,
      ),
    )
    .toBe(1);
  expect(modelResources.size).toBeGreaterThan(0);
});
