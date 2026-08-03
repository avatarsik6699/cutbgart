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
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: phase33RealRun
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
