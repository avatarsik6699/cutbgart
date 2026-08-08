export const PHASE_42_PERFORMANCE_SCHEMA_VERSION = "phase-42.performance.v1" as const;

export type Phase42PerformanceRun = Readonly<{
  schemaVersion: typeof PHASE_42_PERFORMANCE_SCHEMA_VERSION;
  runId: "mocked-browser" | "host-real-model" | "windows-target";
  buildMode: "development" | "production";
  fullWorkflowMs: number | null;
  coldInputMs: number | null;
  warmInputMs: number | null;
  maximumLongTaskMs: number | null;
  maximumEventToNextPaintMs: number | null;
  maximumHeavyJobs: number;
  automaticInferenceCount: number | null;
  cachedSelectionInferenceCount: number | null;
  interactionSamples: number;
  missedActions: number;
  unresponsiveInteractions: number;
  churnCycles: number;
  resourcesAfterChurn: Readonly<{
    artifacts: number;
    leases: number;
    objectUrls: number;
  }>;
  residualOwnership: Readonly<{
    actors: number;
    runtimes: number;
    listeners: number;
    sessions: number;
  }>;
  limitations: readonly string[];
}>;

export type Phase42PerformanceEvaluation = Readonly<{
  status: "pass" | "inconclusive" | "fail";
  findings: readonly string[];
  unsupportedSignalIds: readonly string[];
}>;

const REQUIRED_RUN_IDS = ["mocked-browser", "host-real-model", "windows-target"] as const;

export function evaluatePhase42Performance(
  runs: readonly Phase42PerformanceRun[],
): Phase42PerformanceEvaluation {
  const findings: string[] = [];
  const runIds = new Set(runs.map((run) => run.runId));
  if (
    runs.length !== REQUIRED_RUN_IDS.length ||
    REQUIRED_RUN_IDS.some((runId) => !runIds.has(runId))
  )
    findings.push("missing required environment run");
  if (runs.some((run) => run.schemaVersion !== PHASE_42_PERFORMANCE_SCHEMA_VERSION))
    findings.push("schema version mismatch");
  if (runs.some((run) => run.maximumHeavyJobs > 1))
    findings.push("heavy-job admission exceeded one");
  if (runs.some((run) => (run.cachedSelectionInferenceCount ?? 0) !== 0))
    findings.push("selection triggered reinference");
  if (runs.some((run) => run.missedActions !== 0))
    findings.push("missed action observed");
  if (runs.some((run) => run.unresponsiveInteractions !== 0))
    findings.push("unresponsive interaction observed");
  if (
    runs.some(
      (run) =>
        run.resourcesAfterChurn.artifacts !== 0 ||
        run.resourcesAfterChurn.leases !== 0 ||
        run.resourcesAfterChurn.objectUrls !== 0 ||
        Object.values(run.residualOwnership).some((count) => count !== 0),
    )
  )
    findings.push("residual resource ownership observed");
  if (runs.some((run) => run.maximumLongTaskMs !== null && run.maximumLongTaskMs >= 50))
    findings.push("long-task budget exceeded");

  if (findings.length > 0) return { status: "fail", findings, unsupportedSignalIds: [] };

  const unsupportedSignalIds = runs.flatMap((run) =>
    [
      ["full-workflow", run.fullWorkflowMs],
      ["cold-input", run.coldInputMs],
      ["warm-input", run.warmInputMs],
      ["long-task", run.maximumLongTaskMs],
      ["event-to-next-paint", run.maximumEventToNextPaintMs],
      ["automatic-inference-count", run.automaticInferenceCount],
      ["cached-selection-inference-count", run.cachedSelectionInferenceCount],
      ["interaction-samples", run.interactionSamples > 0 ? run.interactionSamples : null],
    ]
      .filter((entry) => entry[1] === null)
      .map((entry) => `${run.runId}:${String(entry[0])}`),
  );
  if (runs.reduce((total, run) => total + run.churnCycles, 0) < 3)
    unsupportedSignalIds.push("complete-product:three-churn-cycles");
  return {
    status: unsupportedSignalIds.length > 0 ? "inconclusive" : "pass",
    findings: [],
    unsupportedSignalIds,
  };
}
