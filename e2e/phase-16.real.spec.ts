import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const SAMPLE =
  process.env.PHASE16_SAMPLE_LIGHT ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sample.jpg");

test.describe.configure({ mode: "serial", timeout: 12 * 60_000 });

test("Phase 16 real models: BEN2 lifecycle and SlimSAM point/box", async ({
  page,
  browserName,
}) => {
  test.skip(process.env.E2E_PHASE16_REAL !== "1", "opt-in host-only device check");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/BEN2|slimsam|ISNet/.test(request.url())) requests.push(request.url());
  });
  await page.goto("/en");
  const capability = await page.evaluate(async () => {
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
      }
    ).gpu;
    const adapter = gpu ? await gpu.requestAdapter() : null;
    return {
      webgpu: Boolean(adapter),
      fp16: adapter?.features.has("shader-f16") ?? false,
      userAgent: navigator.userAgent,
    };
  });

  await page.getByRole("radio", { name: /BEN2 Fine detail/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  await expect(page.getByRole("slider", { name: /before\/after/i })).toBeVisible({
    timeout: 8 * 60_000,
  });
  const benFallback = await page
    .getByText(/BEN2 could not run/)
    .isVisible()
    .catch(() => false);
  await page.getByRole("button", { name: /Process another image/ }).click();

  await page.getByRole("button", { name: /Point or box/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  const guidedImage = page.getByRole("img", { name: /guided object selection/i });
  await expect(guidedImage).toBeVisible({ timeout: 4 * 60_000 });
  await expect(
    page.getByTestId("guided-selection").getByText(/Choose a point or draw a box/i),
  ).toBeVisible({
    timeout: 4 * 60_000,
  });
  await guidedImage.press("Enter");
  await expect(page.getByTestId("guided-positive-marker")).toBeVisible();
  const accept = page.getByRole("button", { name: /Accept and refine/ });
  await expect(accept.or(page.getByRole("alert"))).toBeVisible({
    timeout: 3 * 60_000,
  });
  await expect(accept).toBeVisible();
  await expect(page.getByTestId("guided-mask-overlay")).toBeVisible();
  await page.getByRole("button", { name: /^Box$/ }).click();
  await guidedImage.press("Enter");
  await expect(page.getByText(/Mask ready/)).toBeVisible({ timeout: 3 * 60_000 });

  console.log(
    `[phase-16-real] ${JSON.stringify({ browserName, capability, benFallback, modelRequestCount: requests.length, sources: [...new Set(requests.map((url) => new URL(url).host))] }, null, 2)}`,
  );
});
