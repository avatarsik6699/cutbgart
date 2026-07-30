import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { expectAutomaticCutout } from "./support/editor-ui";
import { installMockInference } from "./support/mock-inference";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.jpg",
);

test.beforeEach(async ({ page }) => installMockInference(page));

test("all production modes are localized and the Optimal preference persists", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("radio", { name: /^Optimal/ })).toBeEnabled();
  await page.getByRole("radio", { name: /^Optimal/ }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("qualityMode")))
    .toBe("max");
  await page.getByRole("radio", { name: /^Maximum/ }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("qualityMode")))
    .toBe("max");
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Optimal/ })).toBeChecked();
  await page.goto("/");
  await expect(page.getByRole("radio", { name: /^Оптимально/ })).toBeChecked();
});

test("IS-Net q8 and fp32 each process with the explicitly selected mode", async ({
  page,
}) => {
  await page.goto("/en");
  const upload = page.getByLabel("Upload an image");
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);
  await page.getByRole("button", { name: /Back to upload/ }).click();
  const precise = page.getByRole("radio", { name: /^Optimal/ });
  await expect(precise).toBeEnabled();
  await precise.click();
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(SAMPLE);
  await expectAutomaticCutout(page);
  const modes = await page.evaluate(() =>
    (
      window as unknown as {
        __mockInferencePosts: Array<{ type: string; qualityMode?: string }>;
      }
    ).__mockInferencePosts
      .filter((post) => post.type === "process")
      .map((post) => post.qualityMode),
  );
  expect(modes).toEqual(["isnet-q8", "isnet-fp32"]);
});

test("Maximum quality without WebGPU falls back once while preserving the upload", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }),
  );
  await page.goto("/en");
  await page.getByRole("radio", { name: /^Maximum/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  await expect(page.getByText(/Maximum quality could not start/)).toBeVisible();
  await expectAutomaticCutout(page);
});

test("Maximum quality OOM keeps the image and falls back once to Optimal", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "__mockBen2Failure", {
      configurable: true,
      value: true,
    }),
  );
  await page.goto("/en");
  await expect(page.getByRole("radio", { name: /^Maximum/ })).toBeEnabled();
  await page.getByRole("radio", { name: /^Maximum/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  await expect(page.getByText(/Maximum quality could not start/)).toBeVisible();
  await expectAutomaticCutout(page);
  const posts = await page.evaluate(
    () =>
      (window as unknown as { __mockInferencePosts: Array<{ type: string }> })
        .__mockInferencePosts,
  );
  expect(posts.filter((post) => post.type === "process")).toHaveLength(1);
});

test("reuses a loaded mode for a batch while BEN2 scheduling stays sequential", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByRole("radio", { name: /^Maximum/ })).toBeEnabled();
  await page.getByRole("radio", { name: /^Maximum/ }).click();
  await page.getByLabel("Upload an image").setInputFiles([SAMPLE, SAMPLE]);
  await expect(page.getByTestId("scheduler-summary")).toContainText("2 done");
  await expect(page.getByTestId("scheduler-summary")).toContainText("0/1 active");
  const posts = await page.evaluate(
    () =>
      (window as unknown as { __mockInferencePosts: Array<{ type: string }> })
        .__mockInferencePosts,
  );
  expect(posts.filter((post) => post.type === "load-model")).toHaveLength(1);
});
