import { readFile } from "node:fs/promises";

import { expect, test } from "./support/editor/fixtures";
import { phase33ImageCorpus } from "./support/editor/image-corpus";

const privateName = "private-source-name.jpg";

test.describe.configure({ retries: 0 });

test.describe("public editor security and privacy", () => {
  test("serves the measured browser security-header policy", async ({ page }) => {
    const response = await page.goto("/en/");
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

  test("analytics and PNG/ZIP exports never contain source metadata or pixels", async ({
    editor,
    page,
  }) => {
    const analyticsBodies: string[] = [];
    await page.route("**/api/send", async (route) => route.fulfill({ status: 204 }));
    page.on("request", (request) => {
      if (request.url().endsWith("/api/send") && request.postData())
        analyticsBodies.push(request.postData()!);
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
    const sample = await readFile(phase33ImageCorpus.smoke.path);
    await page.goto("/en/");
    await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
    await page.getByLabel("Upload an image").setInputFiles({
      name: privateName,
      mimeType: "image/jpeg",
      buffer: sample,
    });
    await expect.poll(editor.scenario.runCount).toBe(1);
    await editor.scenario.completeRun();

    const singleDownload = await editor.exportPng.download();
    const singlePath = await singleDownload.path();
    if (singlePath === null) throw new Error("Single PNG download path unavailable");
    const singleBytes = await readFile(singlePath);
    expect(singleBytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(singleBytes.toString("latin1")).not.toContain(privateName);

    await expect.poll(() => analyticsBodies.length).toBeGreaterThan(0);
    const analyticsPayload = analyticsBodies.join("\n");
    expect(analyticsPayload).toContain("download_clicked");
    expect(analyticsPayload).not.toContain(privateName);
    expect(analyticsPayload).not.toContain(sample.subarray(0, 16).toString("base64"));
    expect(analyticsPayload).not.toMatch(/sha256|exif|mask|pixel/i);

    await editor.preview.resetButton.click();
    await page.getByLabel("Upload an image").setInputFiles([
      { name: privateName, mimeType: "image/jpeg", buffer: sample },
      { name: "second-private.jpg", mimeType: "image/jpeg", buffer: sample },
    ]);
    await expect.poll(editor.scenario.runCount).toBe(2);
    await editor.scenario.completeRun();
    await expect.poll(editor.scenario.runCount).toBe(3);
    await editor.scenario.completeRun();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Output options" }).click();
    await page.getByRole("menuitem", { name: /Download all/ }).click();
    const zipPath = await (await pending).path();
    if (zipPath === null) throw new Error("Batch ZIP download path unavailable");
    const zipText = (await readFile(zipPath)).toString("latin1");
    expect(zipText).toContain("cutbg-result-01.png");
    expect(zipText).toContain("cutbg-result-02.png");
    expect(zipText).not.toContain(privateName);
    expect(zipText).not.toContain("second-private.jpg");
  });

  test("clearing downloaded models preserves active editor work", async ({
    editor,
    page,
  }) => {
    await page.goto("/en/");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))))
      await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
        timeout: 15_000,
      })
      .toBe(true);
    await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
    await editor.upload.choose(phase33ImageCorpus.smoke.path);
    await expect.poll(editor.scenario.runCount).toBe(1);
    await editor.scenario.completeRun();
    await page.evaluate(async () => {
      const cache = await caches.open("bg-remove-model-cache-v2-v0.22.0");
      await cache.put(
        new Request(
          "https://cdn.cutbg.art/models/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/config.json",
        ),
        new Response("fixture", {
          headers: {
            "X-Cutbg-Asset-Sha256":
              "d0b94ab052ace79177085c66a00a3f014a973edb09999cb0108bb01e65ded060",
            "X-Cutbg-Model-Release": "v0.22.0",
          },
        }),
      );
    });
    await page.getByTestId("model-storage-trigger").click();
    await expect(page.getByTestId("model-storage-manager")).toBeVisible();
    const clearModels = page.getByRole("button", { name: /clear downloaded models/i });
    await expect(clearModels).toBeEnabled();
    await clearModels.click();
    await expect(page.getByText(/active editor work was kept/i)).toBeVisible();
    await expect(editor.exportPng.button).toBeEnabled();
  });

  test("rejects malformed and unsupported images before inference", async ({
    editor,
    page,
  }) => {
    await page.goto("/en/");
    await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
    const upload = page.getByLabel("Upload an image");
    await upload.setInputFiles({
      name: "unsupported.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await expect(page.getByRole("alert")).toContainText(/not supported|format/i);
    expect(await editor.scenario.runCount()).toBe(0);
    await page.getByRole("button", { name: /try again/i }).click();
    await upload.setInputFiles({
      name: "malformed.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not a jpeg"),
    });
    await expect(page.getByRole("alert")).toContainText(/could not be read/i);
    expect(await editor.scenario.runCount()).toBe(0);
  });
});
