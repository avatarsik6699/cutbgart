import { defineConfig, devices } from "@playwright/test";

const realModelRun = process.env.E2E_REAL_MODEL === "1";
const modelLabRealRun = process.env.E2E_MODEL_LAB_REAL === "1";
const mattingLabRealRun = process.env.E2E_MATTING_LAB_REAL === "1";
const phase16RealRun = process.env.E2E_PHASE16_REAL === "1";
const phase17RealRun = process.env.E2E_PHASE17_REAL === "1";
const phase19RealRun = process.env.E2E_PHASE19_REAL === "1";
const phase20RealRun = process.env.E2E_PHASE20_REAL === "1";
const phase21RealRun = process.env.E2E_PHASE21_REAL === "1";
const phase33RealRun = process.env.E2E_PHASE33_REAL === "1";
const phase34RealRun = process.env.E2E_PHASE34_REAL === "1";
const phase35RealRun = process.env.E2E_PHASE35_REAL === "1";
const phase36RealRun = process.env.E2E_PHASE36_REAL === "1";
const phase37RealRun = process.env.E2E_PHASE37_REAL === "1";
const phase38RealRun = process.env.E2E_PHASE38_REAL === "1";
const phase39RealRun = process.env.E2E_PHASE39_REAL === "1";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: phase39RealRun
    ? "**/phase-39-main-page-ui.real.spec.ts"
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
                : phase21RealRun
                  ? "**/phase-21.real.spec.ts"
                  : phase20RealRun
                    ? "**/phase-20.real.spec.ts"
                    : mattingLabRealRun
                      ? "**/matting-lab.real.spec.ts"
                      : phase19RealRun
                        ? "**/phase-19.real.spec.ts"
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
    phase39RealRun ||
    phase38RealRun ||
    phase37RealRun ||
    phase36RealRun ||
    phase35RealRun ||
    phase34RealRun ||
    phase33RealRun ||
    phase21RealRun ||
    phase20RealRun ||
    mattingLabRealRun ||
    phase19RealRun ||
    phase17RealRun ||
    phase16RealRun ||
    modelLabRealRun ||
    realModelRun
      ? []
      : [
          "**/real-model.spec.ts",
          "**/*.real.spec.ts",
          // Phase-16/17 production journeys were superseded by Phase 21.
          // Their source/unit compatibility tests remain; deterministic UI
          // coverage now lives in brush-guided-correction.spec.ts.
          "**/guided-selection.spec.ts",
          "**/iterative-guidance.spec.ts",
          // SPEC v1.36: these route-level batch/cutover journeys are historical while
          // /editor-v2 hosts the incremental single-image main-page migration slice.
          // Their domain/runtime/resource contracts remain covered by Vitest; a later
          // batch UI slice restores route-level browser coverage.
          "**/phase-37-batch-workspace.spec.ts",
          "**/phase-38-cutover-readiness.spec.ts",
        ],
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
