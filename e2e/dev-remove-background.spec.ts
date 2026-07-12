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

  test("renders the harness and the quality toggle", async ({ page }) => {
    await page.goto("/dev/remove-background");

    await expect(page.getByTestId("remove-background-test-harness")).toBeVisible();
    await expect(page.getByText(/^state: idle$/)).toBeVisible();
    await expect(page.getByRole("switch")).toBeVisible();
  });

  test("toggling quality mode persists across reloads", async ({ page }) => {
    await page.goto("/dev/remove-background");

    // Device-capability detection resolves in a post-hydration effect and
    // flips this line away from its "detecting…" placeholder — waiting for
    // it also guards against clicking the switch before React has hydrated
    // and attached its handlers (the SSR markup is otherwise indistinguishable
    // from the hydrated markup, so Playwright's actionability checks alone
    // don't catch that race).
    await expect(page.getByText(/^device: (?!detecting)/)).toBeVisible();

    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible();

    const wasChecked = (await toggle.getAttribute("data-checked")) !== null;

    await toggle.click();

    const expectedStoredMode = wasChecked ? "fast" : "max";
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("qualityMode")))
      .toBe(expectedStoredMode);

    await page.reload();

    // The server always renders the switch unchecked (SSR has no access to
    // `localStorage`, per `useQualityMode`'s `typeof window === "undefined"`
    // guard) — hydration is what corrects it to the stored preference, so
    // wait for the same post-hydration signal before reading the attribute.
    await expect(page.getByText(/^device: (?!detecting)/)).toBeVisible();

    const toggleAfterReload = page.getByRole("switch");
    await expect
      .poll(() => toggleAfterReload.getAttribute("data-checked"))
      .toBe(wasChecked ? null : "");
  });
});
