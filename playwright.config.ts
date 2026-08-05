import { defineConfig, devices } from "@playwright/test";

const modelLabRealRun = process.env.E2E_MODEL_LAB_REAL === "1";
const mattingLabRealRun = process.env.E2E_MATTING_LAB_REAL === "1";
const phase33RealRun = process.env.E2E_PHASE33_REAL === "1";
const phase34RealRun = process.env.E2E_PHASE34_REAL === "1";
const phase35RealRun = process.env.E2E_PHASE35_REAL === "1";
const phase36RealRun = process.env.E2E_PHASE36_REAL === "1";
const phase37RealRun = process.env.E2E_PHASE37_REAL === "1";
const phase38RealRun = process.env.E2E_PHASE38_REAL === "1";
const phase43RealRun = process.env.E2E_PHASE43_REAL === "1";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: phase43RealRun
    ? "**/phase-43-public-cutover.real.spec.ts"
    : phase38RealRun
      ? "**/phase-38-cutover-readiness.real.spec.ts"
      : phase37RealRun
        ? "**/phase-37-batch-workspace.real.spec.ts"
        : phase36RealRun
          ? "**/phase-36-finishing-tools.real.spec.ts"
          : phase35RealRun
            ? "**/phase-35-magic-cutout.real.spec.ts"
            : phase34RealRun
              ? "**/phase-34-manual-cutout.real.spec.ts"
              : phase33RealRun
                ? "**/phase-33-editor-v2.real.spec.ts"
                : mattingLabRealRun
                  ? "**/matting-lab.real.spec.ts"
                  : modelLabRealRun
                    ? "**/model-lab.real.spec.ts"
                    : "**/*.spec.ts",
  testIgnore:
    phase43RealRun ||
    phase38RealRun ||
    phase37RealRun ||
    phase36RealRun ||
    phase35RealRun ||
    phase34RealRun ||
    phase33RealRun ||
    mattingLabRealRun ||
    modelLabRealRun
      ? []
      : ["**/*.real.spec.ts"],
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
    // Chrome/Edge desktop — WebGPU + fp16 inference path (SPEC.md §7.4).
    // Firefox/WebKit/Mobile Safari projects were dropped from the fast
    // regression gate in Phase 31 to bound local/CI E2E runtime; Phase 33's
    // physical-device sample is now the only compatibility evidence for
    // those engines (SPEC.md §7.4, PHASE_31_FINDINGS.md).
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
