import { describe, expect, it } from "vitest";

import type { Phase38PerformanceRun } from "./phase-38";
import {
  evaluatePhase38Performance,
  PHASE_38_PERFORMANCE_SCHEMA_VERSION,
} from "./phase-38";

function run(
  runId: Phase38PerformanceRun["runId"],
  overrides: Partial<Phase38PerformanceRun> = {},
): Phase38PerformanceRun {
  return {
    schemaVersion: PHASE_38_PERFORMANCE_SCHEMA_VERSION,
    runId,
    fullWorkflowMs: 1,
    coldInputMs: 1,
    warmInputMs: 1,
    maximumLongTaskMs: 0,
    maximumHeavyJobs: 1,
    automaticInferenceCount: 2,
    cachedSelectionInferenceCount: 0,
    churnCycles: runId === "mocked-browser" ? 3 : 0,
    missedActions: 0,
    resourcesAfterChurn: { artifacts: 0, leases: 0, objectUrls: 0 },
    residualOwnership: { actors: 0, runtimes: 0, listeners: 0, sessions: 0 },
    limitations: ["Bounded environment-specific evidence."],
    ...overrides,
  };
}

describe("Phase 38 performance evidence", () => {
  it("passes complete bounded evidence", () => {
    expect(
      evaluatePhase38Performance([
        run("mocked-browser"),
        run("host-real-model"),
        run("windows-target"),
      ]),
    ).toEqual({ status: "pass", findings: [] });
  });

  it("is inconclusive, not passing, when timing signals are unsupported", () => {
    expect(
      evaluatePhase38Performance([
        run("mocked-browser"),
        run("host-real-model", { coldInputMs: null }),
        run("windows-target"),
      ]).status,
    ).toBe("inconclusive");
  });

  it.each([
    ["long task", { maximumLongTaskMs: 50 }],
    ["reinference", { cachedSelectionInferenceCount: 1 }],
    [
      "residual",
      { residualOwnership: { actors: 1, runtimes: 0, listeners: 0, sessions: 0 } },
    ],
    ["missed action", { missedActions: 1 }],
  ])("fails on %s", (_label, overrides) => {
    expect(
      evaluatePhase38Performance([
        run("mocked-browser", overrides),
        run("host-real-model"),
        run("windows-target"),
      ]).status,
    ).toBe("fail");
  });
});
