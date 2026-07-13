import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(__dirname, "fixtures", "sample.jpg");

test("real model smoke: upload -> inference -> result", async ({ context, page }) => {
  test.setTimeout(6 * 60 * 1000);
  const assetUrls = new Set<string>();
  context.on("request", (request) => {
    if (/\/resolve\/|\/onnxruntime-web\//.test(request.url())) {
      assetUrls.add(request.url());
    }
  });
  context.on("response", (response) => {
    if (/\/resolve\/|\/onnxruntime-web\//.test(response.url())) {
      console.log(`[real-model] ${String(response.status())} ${response.url()}`);
      if (response.url().endsWith(".mjs")) {
        void response.allHeaders().then((headers) => {
          console.log(
            `[real-model] ORT module headers: content-type=${String(headers["content-type"])} cf-cache-status=${String(headers["cf-cache-status"])} age=${String(headers.age)} cf-ray=${String(headers["cf-ray"])}`,
          );
        });
      }
    }
  });
  context.on("requestfailed", (request) => {
    if (/\/resolve\/|\/onnxruntime-web\//.test(request.url())) {
      const failure = request.failure()?.errorText ?? "unknown failure";
      console.log(`[real-model] ${failure} ${request.url()}`);
    }
  });
  await page.goto("/");
  const upload = page.getByLabel("Загрузить изображения");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE_IMAGE);
  await expect(page.locator("p", { hasText: /загружаем модель/i })).toBeVisible();
  const slider = page.getByRole("slider");
  const loadError = page.getByRole("alert").filter({
    hasText: /Model load failed from both/i,
  });
  const outcome = await Promise.race([
    slider.waitFor({ state: "visible", timeout: 4 * 60 * 1000 }).then(() => "result"),
    loadError.waitFor({ state: "visible", timeout: 4 * 60 * 1000 }).then(() => "error"),
  ]);
  if (outcome === "error") {
    await page.getByRole("button", { name: /показать журнал/i }).click();
    console.log(`[real-model] worker log:\n${await page.locator("ul").innerText()}`);
  }
  expect(outcome).toBe("result");
  await expect(page.getByRole("button", { name: /^скачать$/i })).toBeVisible();

  const urls = [...assetUrls];
  const modelUrls = urls.filter((url) =>
    url.includes("onnx-community/ISNet-ONNX/resolve/"),
  );
  expect(modelUrls.length).toBeGreaterThan(0);
  expect(
    modelUrls.every((url) =>
      url.includes("/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/"),
    ),
  ).toBe(true);
  const sources = [...new Set(urls.map((url) => new URL(url).hostname))];
  console.log(`[real-model] asset sources: ${sources.join(", ")}`);
});
