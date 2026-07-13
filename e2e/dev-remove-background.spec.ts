import { expect, test } from "@playwright/test";

test.describe("/dev/remove-background", () => {
  test.beforeEach(async ({ page }) => {
    // Capability detection is not under test here. Force the deterministic WASM
    // branch so a headless Chromium WebGPU adapter probe cannot delay hydration.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: undefined,
      });
    });
  });

  test("renders the harness and processing modes", async ({ page }) => {
    await page.goto("/dev/remove-background");

    await expect(page.getByTestId("remove-background-test-harness")).toBeVisible();
    await expect(page.getByText(/^state: idle$/)).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(3);
  });

  test("IS-Net preference persists while BEN2 remains session-only", async ({ page }) => {
    await page.goto("/dev/remove-background");

    // Device-capability detection resolves in a post-hydration effect and
    // flips this line away from its "detecting…" placeholder — waiting for
    // it also guards against clicking the switch before React has hydrated
    // and attached its handlers (the SSR markup is otherwise indistinguishable
    // from the hydrated markup, so Playwright's actionability checks alone
    // don't catch that race).
    await expect(page.getByText(/^device: (?!detecting)/)).toBeVisible();

    const precise = page.locator('input[type="radio"][value="isnet-fp32"]');
    await precise.click();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("qualityMode")))
      .toBe("max");
    await page.locator('input[type="radio"][value="ben2-fp16"]').click();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("qualityMode")))
      .toBe("max");

    await page.reload();

    // The server always renders the switch unchecked (SSR has no access to
    // `localStorage`, per `useQualityMode`'s `typeof window === "undefined"`
    // guard) — hydration is what corrects it to the stored preference, so
    // wait for the same post-hydration signal before reading the attribute.
    await expect(page.getByText(/^device: (?!detecting)/)).toBeVisible();

    await expect(page.locator('input[type="radio"][value="isnet-fp32"]')).toBeChecked();
  });
});
