import { defineConfig, devices } from "@playwright/test";

const realModelRun = process.env.E2E_REAL_MODEL === "1";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: realModelRun ? undefined : "**/real-model.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    actionTimeout: 10_000,
  },
  projects: [
    // Chrome/Edge desktop — WebGPU + fp16 inference path (SPEC.md §7.4, high priority).
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Safari desktop — Playwright's WebKit has no WebGPU support, so this
    // exercises the automatic WASM fallback path (SPEC.md §7.4, high priority).
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // iOS Safari — same WASM fallback path with a mobile viewport + touch
    // input; SPEC.md §7.4 explicitly requires Safari/iOS coverage, not just
    // desktop (real-device verification still needed manually per the spec's
    // "requires testing on a real device, not just emulation" note).
    { name: "Mobile Safari", use: { ...devices["iPhone 14"] } },
  ],
});
