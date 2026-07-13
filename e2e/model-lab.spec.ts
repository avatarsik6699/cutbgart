import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

const labEnabled = process.env.VITE_ENABLE_MODEL_LAB === "true";

async function installMockModelLab(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const diagnostics = { posts: [] as Array<[string, number]>, active: 0, maxActive: 0 };
    Object.defineProperty(window, "__modelLabDiagnostics", {
      configurable: true,
      value: diagnostics,
    });
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: undefined,
    });

    class MockModelLabWorker extends EventTarget {
      postMessage(message: {
        type: string;
        requestId: string;
        modelId: string;
        imageOrdinal: number;
        inferencePath: string;
        source: { blob: Blob; width: number; height: number };
      }): void {
        if (message.type !== "process") return;
        diagnostics.posts.push([message.modelId, message.imageOrdinal]);
        diagnostics.active += 1;
        diagnostics.maxActive = Math.max(diagnostics.maxActive, diagnostics.active);
        this.emit({
          type: "progress",
          requestId: message.requestId,
          modelId: message.modelId,
          stage: "loading",
          percent: 50,
        });
        window.setTimeout(() => {
          diagnostics.active -= 1;
          this.emit({
            type: "result",
            requestId: message.requestId,
            modelId: message.modelId,
            imageOrdinal: message.imageOrdinal,
            result: message.source.blob,
            matte: {
              width: message.source.width,
              height: message.source.height,
              data: new Uint8ClampedArray(
                message.source.width * message.source.height,
              ).fill(255),
            },
            measurement: {
              imageOrdinal: message.imageOrdinal,
              modelId: message.modelId,
              requestedPath: message.inferencePath,
              actualPath: "wasm",
              status: "success",
              loadMs: 120,
              inferenceMs: 15,
            },
          });
        }, 30);
      }

      terminate(): void {
        // no-op
      }

      private emit(data: unknown): void {
        this.dispatchEvent(new MessageEvent("message", { data }));
      }
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: MockModelLabWorker,
    });
  });
}

test.describe("/dev/model-lab", () => {
  test("disabled builds render an unavailable state without creating a worker", async ({
    page,
  }) => {
    test.skip(labEnabled, "This assertion targets the default disabled build");
    await installMockModelLab(page);
    await page.goto("/dev/model-lab");
    await expect(page.getByTestId("model-lab-disabled")).toBeVisible();
    await expect(page.getByTestId("model-lab")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __modelLabDiagnostics: { posts: unknown[] };
              }
            ).__modelLabDiagnostics.posts.length,
        ),
      )
      .toBe(0);
  });

  test("runs candidates sequentially and exports privacy-safe JSON", async ({ page }) => {
    test.skip(!labEnabled, "Enable with VITE_ENABLE_MODEL_LAB=true");
    await installMockModelLab(page);
    await page.goto("/dev/model-lab");
    await expect(page.getByTestId("model-lab-capabilities")).not.toContainText(
      "определяется",
    );

    await page.getByLabel("IS-Net q8").uncheck();
    await page.getByLabel("IS-Net fp32").uncheck();
    await page.getByTestId("model-lab-files").setInputFiles({
      name: "private-product-name.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile("e2e/fixtures/sample.jpg"),
    });

    await expect(page.getByText("Загружено: 1.")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __modelLabDiagnostics: { posts: unknown[] };
              }
            ).__modelLabDiagnostics.posts.length,
        ),
      )
      .toBe(0);

    await page.getByRole("button", { name: "Запустить сравнение" }).click();
    await expect(page.getByTestId("model-lab-progress")).toContainText("complete · 2/2");
    await expect(
      page.getByRole("link", { name: "Скачать полноразмерный результат" }),
    ).toHaveCount(2);
    await page.getByLabel("Лучший результат для изображения 1").selectOption("mvanet-q4");

    const diagnostics = await page.evaluate(
      () =>
        (
          window as unknown as {
            __modelLabDiagnostics: {
              posts: Array<[string, number]>;
              maxActive: number;
            };
          }
        ).__modelLabDiagnostics,
    );
    expect(diagnostics.posts).toEqual([
      ["ben2-fp16", 1],
      ["mvanet-q4", 1],
    ]);
    expect(diagnostics.maxActive).toBe(1);

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("model-lab-export").click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const text = await readFile(downloadPath, "utf8");
    const report = JSON.parse(text) as {
      imageCount: number;
      preferences: Array<{ preferredModelId: string }>;
    };
    expect(report.imageCount).toBe(1);
    expect(report.preferences).toEqual([
      { imageOrdinal: 1, preferredModelId: "mvanet-q4" },
    ]);
    expect(text).not.toContain("private-product-name.jpg");
    expect(text).not.toMatch(/blob:|data:image|sourceUrl|resultUrl/);
  });
});
