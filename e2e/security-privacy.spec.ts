import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";

const directory = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.join(directory, "fixtures", "sample.jpg");
const privateName = "private-source-name.jpg";

test.describe("Phase 22 security and privacy", () => {
  test.beforeEach(async ({ page }) => {
    await installMockInference(page);
  });

  test("serves the measured browser security-header policy", async ({ page }) => {
    const response = await page.goto("/en");
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("'wasm-unsafe-eval'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["cross-origin-opener-policy"]).toBeUndefined();
    expect(headers["cross-origin-embedder-policy"]).toBeUndefined();
    const securityTxt = await page.request.get("/.well-known/security.txt");
    expect(securityTxt.ok()).toBe(true);
    await expect(securityTxt.text()).resolves.toContain(
      "Contact: https://t.me/+HaqBWI1A3vg4MWJi",
    );
  });

  test("single and batch analytics/export never contain source metadata or pixels", async ({
    page,
  }) => {
    const analyticsBodies: string[] = [];
    await page.route("**/api/send", async (route) => {
      await route.fulfill({ status: 204 });
    });
    page.on("request", (request) => {
      if (request.url().endsWith("/api/send") && request.postData()) {
        analyticsBodies.push(request.postData()!);
      }
    });
    await page.addInitScript(() => {
      window.umami = {
        track(event, data) {
          void fetch("/api/send", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ event, data }),
          });
        },
      };
    });
    const sample = await readFile(samplePath);
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles({
      name: privateName,
      mimeType: "image/jpeg",
      buffer: sample,
    });
    await expect(page.getByRole("slider")).toBeVisible();

    const singleDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download$/i }).click();
    const singlePath = await (await singleDownload).path();
    if (!singlePath) throw new Error("Single PNG download path unavailable");
    const singleBytes = await readFile(singlePath);
    expect(singleBytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(singleBytes.toString("latin1")).not.toContain(privateName);

    await expect.poll(() => analyticsBodies.length).toBeGreaterThan(0);
    const analyticsPayload = analyticsBodies.join("\n");
    expect(analyticsPayload).toContain("processing_completed");
    expect(analyticsPayload).not.toContain(privateName);
    expect(analyticsPayload).not.toContain(sample.subarray(0, 16).toString("base64"));
    expect(analyticsPayload).not.toMatch(/sha256|exif|mask|pixel/i);

    await page.getByRole("button", { name: /process another image/i }).click();
    const batchUpload = page.getByLabel("Upload an image");
    await batchUpload.setInputFiles([
      { name: privateName, mimeType: "image/jpeg", buffer: sample },
      { name: "second-private.jpg", mimeType: "image/jpeg", buffer: sample },
    ]);
    await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");
    const batchDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download all$/i }).click();
    const zipPath = await (await batchDownload).path();
    if (!zipPath) throw new Error("Batch ZIP download path unavailable");
    const zipText = (await readFile(zipPath)).toString("latin1");
    expect(zipText).toContain("cutbg-result-1.png");
    expect(zipText).toContain("cutbg-result-2.png");
    expect(zipText).not.toContain(privateName);
    expect(zipText).not.toContain("second-private.jpg");
  });

  test("clearing downloaded models preserves active editor work", async ({ page }) => {
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(samplePath);
    await expect(page.getByRole("slider")).toBeVisible();
    await page.evaluate(async () => {
      const cache = await caches.open("bg-remove-model-cache-v2-v0.22.0");
      await cache.put(
        new Request(
          "https://cdn.cutbg.art/models/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/onnx/model_quantized.onnx",
        ),
        new Response("fixture", {
          headers: {
            "X-Cutbg-Asset-Sha256":
              "9f5c5fa3ccc771612d5290a648f055f94a4fa4ce289c6b3df7258e7e10e87a42",
            "X-Cutbg-Model-Release": "v0.22.0",
          },
        }),
      );
    });

    const manager = page.getByTestId("model-storage-manager");
    await manager.locator("summary").click();
    await expect(page.getByTestId("model-storage-usage")).toContainText(
      /MB across 1 downloaded file/i,
    );
    await page.getByRole("button", { name: /clear downloaded models/i }).click();
    await expect(page.getByText(/active editor work was kept/i)).toBeVisible();
    await expect(page.getByRole("slider")).toBeVisible();
    await expect(page.getByRole("button", { name: /^download$/i })).toBeEnabled();
  });

  test("recovers from an unavailable verified asset by clearing and retrying", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (
        window as unknown as { __mockModelAssetFailureOnce: boolean }
      ).__mockModelAssetFailureOnce = true;
    });
    await page.goto("/en");
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles(samplePath);
    await expect(page.getByRole("alert")).toContainText(/unavailable or corrupt/i);
    await page.getByRole("button", { name: /clear models and retry/i }).click();
    await expect(page.getByRole("slider")).toBeVisible();
  });

  test("rejects malformed and decompression-bomb-like images before inference", async ({
    page,
  }) => {
    await page.goto("/en");
    const bomb = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bomb);
    bomb.writeUInt32BE(65_535, 16);
    bomb.writeUInt32BE(65_535, 20);
    const upload = page.getByLabel("Upload an image");
    await expect(upload).toBeEnabled();
    await upload.setInputFiles({
      name: "small-bomb.png",
      mimeType: "image/png",
      buffer: bomb,
    });
    await expect(page.getByRole("alert")).toContainText(/supported resolution/i);
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as {
              __mockInferencePosts: Array<{ type: string }>;
            }
          ).__mockInferencePosts.length,
      ),
    ).toBe(0);

    await page.getByRole("button", { name: /^reset$/i }).click();
    await upload.setInputFiles({
      name: "malformed.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not a jpeg"),
    });
    await expect(page.getByRole("alert")).toContainText(/unsupported file format/i);
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as {
              __mockInferencePosts: Array<{ type: string }>;
            }
          ).__mockInferencePosts.length,
      ),
    ).toBe(0);
  });
});
