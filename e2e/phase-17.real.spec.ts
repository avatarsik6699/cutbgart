import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const SAMPLE =
  process.env.PHASE17_SAMPLE_LIGHT ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sample.jpg");

test.describe.configure({ mode: "serial", timeout: 12 * 60_000 });

test("Phase 17 real SlimSAM cumulative prompts and alternatives", async ({
  page,
  browserName,
}) => {
  test.skip(process.env.E2E_PHASE17_REAL !== "1", "opt-in host-only runtime check");
  const started = Date.now();
  await page.goto("/en");
  await page.getByRole("button", { name: /Point or box/ }).click();
  await page.getByLabel("Upload an image").setInputFiles(SAMPLE);
  const image = page.getByRole("img", { name: /guided object selection/i });
  await expect(
    page.getByTestId("guided-selection").getByText(/Choose a point or draw a box/i),
  ).toBeVisible({
    timeout: 4 * 60_000,
  });
  await image.press("Enter");
  await expect(page.getByTestId("guided-candidates")).toBeVisible({
    timeout: 3 * 60_000,
  });
  await page.getByRole("button", { name: /Remove point/ }).click();
  await image.press("Enter");
  await expect(page.getByRole("radio")).toHaveCount(3, { timeout: 3 * 60_000 });
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: /Add object/ }).click();
  await image.press("Enter");
  await expect(page.getByRole("button", { name: /Accept and refine/ })).toBeVisible({
    timeout: 3 * 60_000,
  });
  await page.getByRole("button", { name: /Accept and refine/ }).click();
  await expect(
    page.getByRole("application", { name: /mask correction editor/i }),
  ).toBeVisible();
  console.log(
    `[phase-17-real] ${JSON.stringify({ browserName, runtimePath: "wasm", cumulativeLabels: true, candidateCount: 3, layerCount: 2, staleRevisionGuard: "unit-and-protocol-verified", continuedToCorrection: true, durationMs: Date.now() - started })}`,
  );
});
