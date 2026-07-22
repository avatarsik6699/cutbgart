import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.beforeEach(async ({ page }) => installMockInference(page));

async function enterDirectGuidance(page: Page) {
  await page.goto("/en");
  await page.getByRole("button", { name: /Point or box/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  await expect(
    page.getByTestId("guided-selection").getByText(/Choose a point or draw a box/),
  ).toBeVisible();
}

async function pointerGesture(
  page: Page,
  tool: RegExp,
  from: [number, number],
  to: [number, number],
) {
  await page.getByRole("button", { name: tool }).click();
  const image = page.getByRole("img", { name: /guided object selection/i });
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  if (!box) throw new Error("Guided image has no bounds");
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1]);
  await page.mouse.up();
}

test("iteratively combines prompts, candidates, layers, stale revisions, correction, and download", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__mockDelayFirstGuidedResponse", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(window, "__mockInvalidGuidedScores", {
      configurable: true,
      value: true,
    });
  });
  await enterDirectGuidance(page);
  const image = page.getByRole("img", { name: /guided object selection/i });
  await image.click({ position: { x: 20, y: 20 } });
  // Cancel the session while its deliberately delayed response is in flight,
  // then start a fresh session. The old worker's response must not overwrite it.
  await page.getByRole("button", { name: /Cancel guided selection/ }).click();
  await page.getByRole("button", { name: /Point or box/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  const restartedImage = page.getByRole("img", { name: /guided object selection/i });
  await expect(
    page.getByTestId("guided-selection").getByText(/Choose a point or draw a box/),
  ).toBeVisible();
  await restartedImage.click({ position: { x: 40, y: 35 } });
  await expect(page.getByTestId("guided-candidates")).toBeVisible();
  await expect(page.getByTestId("guided-candidates")).not.toContainText("NaN");
  await expect(page.getByTestId("guided-candidates")).toContainText(
    "quality estimate unavailable",
  );
  await expect(page.getByTestId("guided-candidate-2")).toContainText(
    /Differs from the recommended alternative/,
  );
  const overlay = page.getByTestId("guided-mask-overlay");
  const recommendedPreview = await overlay.evaluate((canvas) =>
    (canvas as HTMLCanvasElement).toDataURL(),
  );
  await page.getByRole("radio").nth(1).check();
  await expect(
    page.getByRole("status").filter({ hasText: /Alternative 2 selected/ }),
  ).toBeAttached();
  await expect
    .poll(() => overlay.evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()))
    .not.toBe(recommendedPreview);
  await page.waitForTimeout(350);
  await expect(page.getByTestId("guided-candidates")).toBeVisible();

  await page.getByRole("button", { name: /Remove point/ }).click();
  await restartedImage.click({ position: { x: 70, y: 45 } });
  const negativeMarkers = page.getByTestId("guided-negative-marker");
  await expect(negativeMarkers).toHaveCount(1);
  await expect(
    page.getByTestId("guided-selection").getByText(/Mask ready/),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(negativeMarkers).toHaveCount(0);
  await expect(
    page.getByTestId("guided-selection").getByText(/Mask ready/),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+y");
  await expect(negativeMarkers).toHaveCount(1);
  await pointerGesture(page, /^Box$/, [0.15, 0.15], [0.8, 0.8]);
  await pointerGesture(page, /Keep stroke/, [0.3, 0.5], [0.5, 0.5]);
  await pointerGesture(page, /Remove stroke/, [0.7, 0.5], [0.8, 0.5]);
  await expect(
    page.getByTestId("guided-selection").getByText(/Mask ready/),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.getByTestId("guided-selection").getByText(/Mask ready/),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.getByRole("button", { name: /Add object/ }).click();
  await restartedImage.press("Enter");
  await expect(page.getByTestId("guided-candidates")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByRole("radio").nth(1).check();

  const posts = await page.evaluate(
    () =>
      (
        window as unknown as {
          __mockInferencePosts: Array<{ type: string; pointLabels?: number[] }>;
        }
      ).__mockInferencePosts,
  );
  expect(posts.some((post) => post.pointLabels?.includes(0))).toBe(true);
  expect(posts.filter((post) => post.type === "encode")).toHaveLength(2);
  await page.getByRole("button", { name: /Accept and refine/ }).click();
  await page.getByRole("button", { name: /Skip and edit with brush/ }).click();
  await expect(
    page.getByRole("application", { name: /mask correction editor/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Done$/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await download).suggestedFilename()).toBe("result.png");
});

test("starts guidance from an automatic matte and preserves the correction flow", async ({
  page,
}) => {
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible();
  await page.getByRole("button", { name: /Refine objects/ }).click();
  await expect(page.getByTestId("guided-selection")).toBeVisible();
  const guidedImage = page.getByRole("img", { name: /guided object selection/i });
  await expect
    .poll(() => guidedImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await guidedImage.press("Enter");
  await expect(page.getByTestId("guided-candidates")).toBeVisible();
  await page.getByRole("button", { name: /Accept and refine/ }).click();
  await page.getByRole("button", { name: /Skip and edit with brush/ }).click();
  await expect(
    page.getByRole("application", { name: /mask correction editor/i }),
  ).toBeVisible();
});
