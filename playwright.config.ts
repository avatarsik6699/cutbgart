import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
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
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
