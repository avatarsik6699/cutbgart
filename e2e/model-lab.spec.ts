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
      private terminated = false;

      postMessage(message: {
        type: string;
        requestId: string;
        modelId: string;
        imageOrdinal: number;
        inferencePath: string;
        source: { blob: Blob; width: number; height: number };
      }): void {
        if (message.type !== "process" && message.type !== "process-interactive") return;
        diagnostics.posts.push([message.modelId, message.imageOrdinal]);
        diagnostics.active += 1;
        diagnostics.maxActive = Math.max(diagnostics.maxActive, diagnostics.active);
        if (message.type === "process-interactive") {
          const interactive = message as typeof message & { caseOrdinal: number };
          this.emit({
            type: "interactive-progress",
            requestId: message.requestId,
            modelId: message.modelId,
            stage: "loading",
            percent: 50,
          });
          window.setTimeout(() => {
            diagnostics.active -= 1;
            if (this.terminated) return;
            if (message.modelId === "efficient-sam-ti") {
              this.emit({
                type: "interactive-error",
                requestId: message.requestId,
                modelId: message.modelId,
                caseOrdinal: interactive.caseOrdinal,
                code: "operator-unsupported",
                message: "No verified browser graph",
                measurement: {
                  caseOrdinal: interactive.caseOrdinal,
                  modelId: message.modelId,
                  requestedPath: message.inferencePath,
                  actualPath: "wasm",
                  status: "unsupported",
                  coldLoadMs: 1,
                  warmInferenceMs: 0,
                  peakMemoryBytes: null,
                  memoryObservation: "unavailable",
                  errorCode: "operator-unsupported",
                },
              });
              return;
            }
            if (
              message.modelId === "vitmatte-small-composition1k-fp32" &&
              interactive.caseOrdinal === 1
            ) {
              this.emit({
                type: "interactive-error",
                requestId: message.requestId,
                modelId: message.modelId,
                caseOrdinal: interactive.caseOrdinal,
                code: "device-out-of-memory",
                message: "Synthetic OOM",
                measurement: {
                  caseOrdinal: interactive.caseOrdinal,
                  modelId: message.modelId,
                  requestedPath: message.inferencePath,
                  actualPath: "wasm",
                  status: "error",
                  coldLoadMs: 10,
                  warmInferenceMs: 0,
                  peakMemoryBytes: null,
                  memoryObservation: "unavailable",
                  errorCode: "device-out-of-memory",
                },
              });
              return;
            }
            this.emit({
              type: "interactive-result",
              requestId: message.requestId,
              modelId: message.modelId,
              caseOrdinal: interactive.caseOrdinal,
              result: message.source.blob,
              matte: {
                width: message.source.width,
                height: message.source.height,
                data: new Uint8ClampedArray(
                  message.source.width * message.source.height,
                ).fill(255),
              },
              measurement: {
                caseOrdinal: interactive.caseOrdinal,
                modelId: message.modelId,
                requestedPath: message.inferencePath,
                actualPath: "wasm",
                status: "success",
                coldLoadMs: interactive.caseOrdinal === 1 ? 120 : 0,
                warmInferenceMs: 15,
                peakMemoryBytes: null,
                memoryObservation: "unavailable",
              },
            });
          }, 120);
          return;
        }
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
        this.terminated = true;
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

  test("runs the opt-in matting corpus sequentially and exports schema v2", async ({
    page,
  }) => {
    test.skip(!labEnabled, "Enable with VITE_ENABLE_MODEL_LAB=true");
    await installMockModelLab(page);
    await page.goto("/dev/model-lab");
    await expect(page.getByTestId("interactive-matting-lab")).toBeVisible();
    await expect(page.getByTestId("model-lab-capabilities")).not.toContainText(
      "определяется",
    );
    await expect(page.getByTestId("run-matting-lab")).toHaveCount(0);

    await page.getByTestId("matting-opt-in").check();
    await expect(page.getByTestId("matting-opt-in")).toBeChecked();
    for (const label of [
      "ViTMatte-small Composition-1k fp32",
      "ViTMatte-small Distinctions-646 q8",
      "ViTMatte-small Distinctions-646 fp32",
    ]) {
      await page.getByLabel(label).uncheck();
    }
    await page.getByTestId("load-matting-corpus").click();
    await expect(page.getByText(/Корпус: 8 случаев/)).toBeVisible();
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

    await page.getByTestId("run-matting-lab").click();
    await expect(page.getByLabel("IS-Net q8")).toBeDisabled();
    await expect(page.getByTestId("matting-lab-progress")).toContainText(
      "complete · 8/8",
    );
    await expect(page.getByLabel("IS-Net q8")).toBeEnabled();
    await expect(page.getByAltText(/alpha preview/)).toHaveCount(8);
    await page
      .getByTestId("matting-decision")
      .selectOption("vitmatte-small-composition1k-q8");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("matting-lab-export").click();
    const download = await downloadPromise;
    const report = JSON.parse(await readFile(await download.path(), "utf8")) as {
      schemaVersion: number;
      corpusCaseCount: number;
      quality: unknown[];
      runtime: unknown[];
      decision: string;
    };
    expect(report).toMatchObject({
      schemaVersion: 2,
      corpusCaseCount: 8,
      decision: "vitmatte-small-composition1k-q8",
    });
    expect(report.quality).toHaveLength(8);
    expect(report.runtime).toHaveLength(8);
    expect(JSON.stringify(report)).not.toMatch(
      /filename|blob:|data:image|sourceUrl|resultUrl|groundTruth|trimap|prompt/i,
    );
  });

  test("classifies unsupported candidates and rejects stale results after cancellation", async ({
    page,
  }) => {
    test.skip(!labEnabled, "Enable with VITE_ENABLE_MODEL_LAB=true");
    await installMockModelLab(page);
    await page.goto("/dev/model-lab");
    await expect(page.getByTestId("model-lab-capabilities")).not.toContainText(
      "определяется",
    );
    await page.getByTestId("matting-opt-in").check();
    await expect(page.getByTestId("matting-opt-in")).toBeChecked();
    for (const label of [
      "ViTMatte-small Composition-1k q8",
      "ViTMatte-small Composition-1k fp32",
      "ViTMatte-small Distinctions-646 q8",
      "ViTMatte-small Distinctions-646 fp32",
    ]) {
      await page.getByLabel(label).uncheck();
    }
    await page.getByLabel("EfficientSAM-Ti").check();
    await page.getByTestId("load-matting-corpus").click();
    await page.getByTestId("run-matting-lab").click();
    await expect(page.getByTestId("matting-lab-progress")).toContainText(
      "complete · 8/8",
    );
    await expect(page.getByText(/unsupported \(operator-unsupported\)/)).toHaveCount(8);

    await page.getByRole("checkbox", { name: "EfficientSAM-Ti", exact: true }).uncheck();
    await page
      .getByRole("checkbox", {
        name: "ViTMatte-small Composition-1k fp32",
        exact: true,
      })
      .check();
    await page.getByTestId("run-matting-lab").click();
    await expect(page.getByTestId("matting-lab-progress")).toContainText(
      "complete · 8/8",
    );
    await expect(page.getByText(/error \(device-out-of-memory\)/)).toHaveCount(1);
    await expect(page.getByAltText(/alpha preview/)).toHaveCount(7);

    await page.getByTestId("run-matting-lab").click();
    await page.getByRole("button", { name: "Отменить matting matrix" }).click();
    await expect(page.getByTestId("matting-lab-progress")).toContainText("cancelled");
    await page.waitForTimeout(100);
    await expect(page.getByTestId("matting-lab-progress")).toContainText("cancelled");
  });
});
