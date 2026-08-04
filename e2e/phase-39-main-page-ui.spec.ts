import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

import { expect, test, type Download, type Page } from "@playwright/test";

import { installMockInference } from "./support/mock-inference";
import {
  advanceMockEditorV2Stage,
  completeMockEditorV2Run,
  installMockEditorV2Worker,
  mockEditorV2RunCount,
} from "./support/mock-editor-v2-worker";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const UNSUPPORTED_FILE = path.join(TEST_DIRECTORY, "fixtures", "unsupported.txt");

const LOCALES = [
  {
    id: "en",
    path: "/en",
    upload: "Upload an image",
    choosePhoto: "Choose photo",
    maximum: /^Maximum/,
    retry: "Try again",
    outputOptions: "Output options",
  },
  {
    id: "ru",
    path: "/",
    upload: "Загрузить изображения",
    choosePhoto: "Выбрать фото",
    maximum: /^Максимум/,
    retry: "Повторить",
    outputOptions: "Параметры результата",
  },
] as const;

const VIEWPORTS = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "narrow", width: 390, height: 844 },
] as const;

type TestWindow = Window & {
  __completeMockModelLoad?: () => void;
  __completeMockProcess?: () => void;
};

async function createLargeReferenceImage(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2200;
    canvas.height = 1400;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.fillStyle = "#3366cc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Could not create reference image")),
        "image/png",
      ),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return {
    name: "phase-39-reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes),
  };
}

async function dispatchFileAdmission(
  page: Page,
  method: "drop" | "paste",
  fixture: Awaited<ReturnType<typeof createLargeReferenceImage>>,
): Promise<void> {
  await page.getByLabel("Upload an image").evaluate(
    (input, payload) => {
      const file = new File([new Uint8Array(payload.bytes)], payload.name, {
        type: payload.mimeType,
      });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      if (payload.method === "drop") {
        input.parentElement?.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
        return;
      }
      window.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
        }),
      );
    },
    {
      bytes: fixture.buffer.toJSON().data,
      method,
      mimeType: fixture.mimeType,
      name: fixture.name,
    },
  );
}

async function expectReferenceScreenshot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    scale: "css",
  });
}

async function expectV2SliceScreenshot(
  page: Page,
  prefix: string,
  state: string,
  acceptedDifference: "single-image-copy" | "editor-tools" | null = null,
): Promise<void> {
  const suffix = acceptedDifference ? `v2-${acceptedDifference}-${state}` : state;
  await expectReferenceScreenshot(page, `${prefix}-${suffix}.png`);
}

async function pngDimensions(download: Download): Promise<{
  width: number;
  height: number;
}> {
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    if (!(chunk instanceof Uint8Array)) throw new Error("Download chunk is not binary");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function completeMockStage(page: Page, stage: "model" | "process"): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          typeof (key === "model"
            ? (window as TestWindow).__completeMockModelLoad
            : (window as TestWindow).__completeMockProcess),
        stage,
      ),
    )
    .toBe("function");
  await page.evaluate((key) => {
    const testWindow = window as TestWindow;
    const complete =
      key === "model"
        ? testWindow.__completeMockModelLoad
        : testWindow.__completeMockProcess;
    if (key === "model") delete testWindow.__completeMockModelLoad;
    else delete testWindow.__completeMockProcess;
    complete?.();
  }, stage);
}

test.describe("Phase 39 frozen v1 main-page reference", () => {
  for (const locale of LOCALES) {
    for (const viewport of VIEWPORTS) {
      test(`${locale.id} ${viewport.id} reference states`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await installMockInference(page, { manualAutomaticStages: true });
        await page.goto(locale.path);
        await expect(
          page.locator('[data-slot="site-header"][data-hydrated="true"]'),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const prefix = `${locale.id}-${viewport.id}`;
        await expectReferenceScreenshot(page, `${prefix}-empty.png`);

        const activeInput =
          viewport.id === "desktop"
            ? page.getByLabel(locale.upload)
            : page.locator('input[type="file"][capture="environment"]');
        await activeInput.focus();
        await expectReferenceScreenshot(page, `${prefix}-input-active.png`);

        await page.getByRole("radio", { name: locale.maximum }).click();
        await expectReferenceScreenshot(page, `${prefix}-quality-choice.png`);

        await activeInput.setInputFiles(UNSUPPORTED_FILE);
        await expect(page.getByRole("alert")).toBeVisible();
        await expectReferenceScreenshot(page, `${prefix}-recoverable-error.png`);
        await page.getByRole("button", { name: locale.retry, exact: true }).click();

        await activeInput.setInputFiles(await createLargeReferenceImage(page));
        await expect(page.getByRole("progressbar")).toBeVisible();
        await expectReferenceScreenshot(page, `${prefix}-model-loading.png`);

        await completeMockStage(page, "model");
        await expect(page.getByTestId("processing-stage-skeleton")).toBeVisible();
        await expectReferenceScreenshot(page, `${prefix}-processing.png`);

        await completeMockStage(page, "process");
        await expect(page.getByTestId("editor-toolbar")).toBeVisible();
        await expectReferenceScreenshot(page, `${prefix}-single-result.png`);

        await page
          .getByRole("button", { name: locale.outputOptions, exact: true })
          .click();
        await expect(page.getByRole("menuitemradio")).toHaveCount(3);
        await expectReferenceScreenshot(page, `${prefix}-export-size.png`);
      });
    }
  }
});

test.describe("Phase 39 v2 main-page parity", () => {
  for (const locale of LOCALES) {
    for (const viewport of VIEWPORTS) {
      test(`${locale.id} ${viewport.id} v2 main states match v1`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await installMockInference(page);
        await installMockEditorV2Worker(page, { manualStages: true });
        const route = locale.id === "en" ? "/en/editor-v2" : "/editor-v2";
        await page.goto(route);
        await expect(
          page.locator('[data-slot="site-header"][data-hydrated="true"]'),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const prefix = `${locale.id}-${viewport.id}`;
        await expectV2SliceScreenshot(page, prefix, "empty");

        const activeInput =
          viewport.id === "desktop"
            ? page.getByLabel(locale.upload)
            : page.locator('input[type="file"][capture="environment"]');
        await activeInput.focus();
        await expectV2SliceScreenshot(page, prefix, "input-active", null);

        await page.getByRole("radio", { name: locale.maximum }).click();
        await expectV2SliceScreenshot(page, prefix, "quality-choice", null);

        await activeInput.setInputFiles(UNSUPPORTED_FILE);
        await expect(page.getByRole("alert")).toBeVisible();
        await expectV2SliceScreenshot(page, prefix, "recoverable-error", null);
        await page.getByRole("button", { name: locale.retry, exact: true }).click();

        await activeInput.setInputFiles(await createLargeReferenceImage(page));
        await expect.poll(() => mockEditorV2RunCount(page)).toBe(1);
        await advanceMockEditorV2Stage(page, "model-loading", 0.5);
        await expect(
          page.locator('[data-main-page-phase="loading-model"]'),
        ).toBeVisible();
        await expectV2SliceScreenshot(page, prefix, "model-loading");

        await advanceMockEditorV2Stage(page, "automatic-remove", 0.5);
        await expect(page.locator('[data-main-page-phase="processing"]')).toBeVisible();
        await expectV2SliceScreenshot(page, prefix, "processing");

        await completeMockEditorV2Run(page);
        await expect(page.getByTestId("editor-tool-workspace")).toBeVisible();
        await expectV2SliceScreenshot(page, prefix, "single-result", "editor-tools");

        await page
          .getByRole("button", { name: locale.outputOptions, exact: true })
          .click();
        await expect(page.getByRole("menuitemradio")).toHaveCount(3);
        await expectV2SliceScreenshot(page, prefix, "export-size", "editor-tools");
        await page.getByRole("menuitemradio", { name: "2048 px" }).click();
        const resizedDownload = page.waitForEvent("download");
        await page
          .getByTestId("download-split-button")
          .getByRole("button", { name: /Download|Скачать/, exact: true })
          .click();
        const resized = await resizedDownload;
        expect(resized.suggestedFilename()).toBe("cutbg-result-2048.png");
        expect(await pngDimensions(resized)).toEqual({ width: 2048, height: 1303 });

        await page
          .getByRole("button", { name: locale.outputOptions, exact: true })
          .click();
        await page.getByRole("menuitemradio", { name: "1024 px" }).click();
        const compactDownload = page.waitForEvent("download");
        await page
          .getByTestId("download-split-button")
          .getByRole("button", { name: /Download|Скачать/, exact: true })
          .click();
        const compact = await compactDownload;
        expect(compact.suggestedFilename()).toBe("cutbg-result-1024.png");
        expect(await pngDimensions(compact)).toEqual({ width: 1024, height: 652 });

        await page
          .getByRole("button", { name: locale.outputOptions, exact: true })
          .click();
        await page
          .getByRole("menuitemradio", {
            name: locale.id === "en" ? "Original" : "Оригинал",
          })
          .click();
        const originalDownload = page.waitForEvent("download");
        await page
          .getByTestId("download-split-button")
          .getByRole("button", { name: /Download|Скачать/, exact: true })
          .click();
        const original = await originalDownload;
        expect(original.suggestedFilename()).toBe("cutbg-result.png");
        expect(await pngDimensions(original)).toEqual({ width: 2200, height: 1400 });
        await expect.poll(() => mockEditorV2RunCount(page)).toBe(1);
      });
    }
  }

  test("drop and paste share v2 admission; cancel, retry, and reset release resources", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS[0]);
    await installMockInference(page);
    await installMockEditorV2Worker(page, { manualStages: true });
    await page.goto("/en/editor-v2");
    const fixture = await createLargeReferenceImage(page);

    await dispatchFileAdmission(page, "drop", fixture);
    await expect.poll(() => mockEditorV2RunCount(page)).toBe(1);
    await page.getByRole("button", { name: "Back to upload", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect.poll(() => mockEditorV2RunCount(page)).toBe(2);
    await completeMockEditorV2Run(page);
    await expect(page.getByTestId("editor-tool-workspace")).toBeVisible();
    await page.getByRole("button", { name: "Back to upload", exact: true }).click();
    await expect(page.getByLabel("Upload an image")).toBeVisible();

    await dispatchFileAdmission(page, "paste", fixture);
    await expect.poll(() => mockEditorV2RunCount(page)).toBe(3);
    await page.getByRole("button", { name: "Back to upload", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to upload", exact: true }).click();
    await expect(page.getByLabel("Upload an image")).toBeVisible();
    await expect(page.getByTestId("home-page")).toHaveAttribute(
      "data-artifact-count",
      "0",
    );
    await expect(page.getByTestId("home-page")).toHaveAttribute("data-lease-count", "0");
    await expect(page.getByTestId("home-page")).toHaveAttribute(
      "data-object-url-count",
      "0",
    );
  });
});
