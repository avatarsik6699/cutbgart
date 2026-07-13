import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SAMPLE_IMAGES = [
  path.join(__dirname, "fixtures", "sample.jpg"),
  path.resolve("public/images/product-photo-example.webp"),
];
const SUPPORTED_IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

async function resolveSampleImages(): Promise<string[]> {
  const inputDirectory = process.env.E2E_MODEL_LAB_IMAGES_DIR;
  if (!inputDirectory) return DEFAULT_SAMPLE_IMAGES;

  const absoluteDirectory = path.resolve(inputDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile() && SUPPORTED_IMAGE_EXTENSION.test(entry.name))
    .map((entry) => path.join(absoluteDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right, "en"));

  if (images.length === 0) {
    throw new Error(`No supported benchmark images found in ${absoluteDirectory}`);
  }
  return images;
}

function resolveStartIndex(imageCount: number): number {
  const rawValue = process.env.E2E_MODEL_LAB_START_AT ?? "1";
  const startAt = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(startAt) || startAt < 1 || startAt > imageCount) {
    throw new Error(`E2E_MODEL_LAB_START_AT must be between 1 and ${String(imageCount)}`);
  }
  return startAt - 1;
}

test("real model lab: BEN2 and MVANet browser compatibility report", async ({ page }) => {
  const allSampleImages = await resolveSampleImages();
  const startIndex = resolveStartIndex(allSampleImages.length);
  const sampleImages = allSampleImages.slice(startIndex);
  const outputDirectory = process.env.E2E_MODEL_LAB_OUTPUT_DIR
    ? path.resolve(process.env.E2E_MODEL_LAB_OUTPUT_DIR)
    : null;
  test.setTimeout(Math.max(12, sampleImages.length * 4) * 60 * 1000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/dev/model-lab");
  await expect(page.getByTestId("model-lab")).toBeVisible();
  await expect(page.getByTestId("model-lab-capabilities")).toContainText("wasm");

  await page.getByLabel("IS-Net q8").uncheck();
  await page.getByLabel("IS-Net fp32").uncheck();
  await page.getByTestId("model-lab-files").setInputFiles(sampleImages);
  await expect(
    page.getByText(`Загружено: ${String(sampleImages.length)}.`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Запустить сравнение" }).click();
  const expectedMeasurements = sampleImages.length * 2;
  await expect(page.getByTestId("model-lab-progress")).toContainText(
    `complete · ${String(expectedMeasurements)}/${String(expectedMeasurements)}`,
    { timeout: Math.max(10, sampleImages.length * 4 - 2) * 60 * 1000 },
  );

  const reportDownloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByTestId("model-lab-export").click();
  const reportDownload = await reportDownloadPromise;
  const reportPath = await reportDownload.path();
  const report = JSON.parse(await readFile(reportPath, "utf8")) as {
    capabilities: { requestedPath: string; userAgent: string };
    measurements: Array<{
      imageOrdinal: number;
      modelId: string;
      status: string;
      loadMs: number;
      inferenceMs: number;
      errorCode?: string;
      fallbackReason?: string;
    }>;
  };
  expect(report.capabilities.requestedPath).toBe("wasm");
  expect(report.measurements).toHaveLength(expectedMeasurements);

  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    const reportFilename =
      startIndex === 0
        ? "benchmark-report.json"
        : `benchmark-report-${String(startIndex + 1)}-${String(allSampleImages.length)}.json`;
    await writeFile(
      path.join(outputDirectory, reportFilename),
      `${JSON.stringify(
        {
          ...report,
          measurements: report.measurements.map((measurement) => ({
            ...measurement,
            imageOrdinal: startIndex + measurement.imageOrdinal,
          })),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      path.join(outputDirectory, "input-manifest.json"),
      `${JSON.stringify(
        allSampleImages.map((imagePath, index) => ({
          imageOrdinal: index + 1,
          sourceFile: path.basename(imagePath),
        })),
        null,
        2,
      )}\n`,
      "utf8",
    );
    for (let ordinal = 1; ordinal <= sampleImages.length; ordinal += 1) {
      const section = page.getByTestId(`model-lab-image-${String(ordinal)}`);
      const resultLinks = section.getByText("Скачать полноразмерный результат", {
        exact: true,
      });
      await expect(resultLinks).toHaveCount(2);
      for (let resultIndex = 0; resultIndex < 2; resultIndex += 1) {
        const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
        await resultLinks.nth(resultIndex).click();
        const resultDownload = await downloadPromise;
        const globalOrdinal = startIndex + ordinal;
        const outputFilename = resultDownload
          .suggestedFilename()
          .replace(/^image-\d+-/, `image-${String(globalOrdinal)}-`);
        await resultDownload.saveAs(path.join(outputDirectory, outputFilename));
      }
    }
  }
  console.log(`[model-lab-real] ${JSON.stringify(report, null, 2)}`);
});
