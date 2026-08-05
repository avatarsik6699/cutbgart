import { describe, expect, it } from "vitest";

import {
  evaluatePhase42Performance,
  PHASE_42_PERFORMANCE_SCHEMA_VERSION,
  type Phase42PerformanceRun,
} from "./phase-42";

function run(
  runId: Phase42PerformanceRun["runId"],
  overrides: Partial<Phase42PerformanceRun> = {},
): Phase42PerformanceRun {
  return {
    schemaVersion: PHASE_42_PERFORMANCE_SCHEMA_VERSION,
    runId,
    buildMode: "production",
    fullWorkflowMs: 1,
    coldInputMs: 1,
    warmInputMs: 1,
    maximumLongTaskMs: 0,
    maximumEventToNextPaintMs: 1,
    maximumHeavyJobs: 1,
    automaticInferenceCount: 2,
    cachedSelectionInferenceCount: 0,
    interactionSamples: 1,
    missedActions: 0,
    unresponsiveInteractions: 0,
    churnCycles: runId === "mocked-browser" ? 3 : 0,
    resourcesAfterChurn: { artifacts: 0, leases: 0, objectUrls: 0 },
    residualOwnership: { actors: 0, runtimes: 0, listeners: 0, sessions: 0 },
    limitations: [],
    ...overrides,
  };
}

function completeRuns(
  overrides: Partial<Phase42PerformanceRun> = {},
): readonly Phase42PerformanceRun[] {
  return [
    run("mocked-browser", overrides),
    run("host-real-model"),
    run("windows-target"),
  ];
}

describe("Phase 42 performance evidence", () => {
  it("passes complete responsiveness and ownership evidence", () => {
    expect(evaluatePhase42Performance(completeRuns())).toEqual({
      status: "pass",
      findings: [],
      unsupportedSignalIds: [],
    });
  });

  it("is inconclusive and names each unsupported signal", () => {
    const evaluation = evaluatePhase42Performance(
      completeRuns({ maximumEventToNextPaintMs: null }),
    );

    expect(evaluation.status).toBe("inconclusive");
    expect(evaluation.unsupportedSignalIds).toEqual([
      "mocked-browser:event-to-next-paint",
    ]);
  });

  it.each([
    ["concurrent heavy work", { maximumHeavyJobs: 2 }],
    ["selection reinference", { cachedSelectionInferenceCount: 1 }],
    ["missed action", { missedActions: 1 }],
    ["unresponsive interaction", { unresponsiveInteractions: 1 }],
    ["long task", { maximumLongTaskMs: 50 }],
    [
      "residual owner",
      { residualOwnership: { actors: 1, runtimes: 0, listeners: 0, sessions: 0 } },
    ],
  ])("fails on %s", (_label, overrides) => {
    expect(
      evaluatePhase42Performance(
        completeRuns(overrides as Partial<Phase42PerformanceRun>),
      ).status,
    ).toBe("fail");
  });
});
