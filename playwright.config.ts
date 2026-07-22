import { defineConfig, devices } from "@playwright/test";

const realModelRun = process.env.E2E_REAL_MODEL === "1";
const modelLabRealRun = process.env.E2E_MODEL_LAB_REAL === "1";
const mattingLabRealRun = process.env.E2E_MATTING_LAB_REAL === "1";
const phase16RealRun = process.env.E2E_PHASE16_REAL === "1";
const phase17RealRun = process.env.E2E_PHASE17_REAL === "1";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: mattingLabRealRun
    ? "**/matting-lab.real.spec.ts"
    : phase17RealRun
      ? "**/phase-17.real.spec.ts"
      : phase16RealRun
        ? "**/phase-16.real.spec.ts"
        : modelLabRealRun
          ? "**/model-lab.real.spec.ts"
          : realModelRun
            ? "**/real-model.spec.ts"
            : "**/*.spec.ts",
  testIgnore:
    mattingLabRealRun ||
    phase17RealRun ||
    phase16RealRun ||
    modelLabRealRun ||
    realModelRun
      ? []
      : ["**/real-model.spec.ts", "**/*.real.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    actionTimeout: 10_000,
  },
  projects: [
    // Chrome/Edge desktop — WebGPU + fp16 inference path (SPEC.md §7.4, high priority).
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // SPEC.md §7.4 also requires desktop Firefox coverage.
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
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
