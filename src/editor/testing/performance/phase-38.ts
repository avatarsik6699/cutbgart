export const PHASE_38_PERFORMANCE_SCHEMA_VERSION = "phase-38.performance.v1" as const;

export type Phase38PerformanceRun = Readonly<{
  schemaVersion: typeof PHASE_38_PERFORMANCE_SCHEMA_VERSION;
  runId: "mocked-browser" | "host-real-model" | "windows-target";
  fullWorkflowMs: number | null;
  coldInputMs: number | null;
  warmInputMs: number | null;
  maximumLongTaskMs: number | null;
  maximumHeavyJobs: number;
  automaticInferenceCount: number | null;
  cachedSelectionInferenceCount: number | null;
  churnCycles: number;
  missedActions: number;
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

export type Phase38PerformanceEvaluation = Readonly<{
  status: "pass" | "inconclusive" | "fail";
  findings: readonly string[];
}>;

export function evaluatePhase38Performance(
  runs: readonly Phase38PerformanceRun[],
): Phase38PerformanceEvaluation {
  const findings: string[] = [];
  const expectedRuns = new Set(["mocked-browser", "host-real-model", "windows-target"]);
  const actualRuns = new Set<string>(runs.map((run) => run.runId));
  if (
    runs.length !== expectedRuns.size ||
    [...expectedRuns].some((id) => !actualRuns.has(id))
  )
    findings.push("missing required environment run");
  if (runs.some((run) => run.schemaVersion !== PHASE_38_PERFORMANCE_SCHEMA_VERSION))
    findings.push("schema version mismatch");
  if (runs.some((run) => run.maximumHeavyJobs > 1))
    findings.push("heavy-job admission exceeded one");
  if (runs.some((run) => (run.cachedSelectionInferenceCount ?? 0) !== 0))
    findings.push("selection triggered reinference");
  if (runs.some((run) => run.missedActions !== 0))
    findings.push("missed action observed");
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
  if (runs.reduce((total, run) => total + run.churnCycles, 0) < 3)
    findings.push("fewer than three churn cycles captured");
  if (runs.some((run) => run.maximumLongTaskMs !== null && run.maximumLongTaskMs >= 50))
    findings.push("long-task budget exceeded");
  if (runs.some((run) => run.limitations.length === 0))
    findings.push("environment limitations missing");
  if (findings.length > 0) return { status: "fail", findings };

  const hasUnsupportedTiming = runs.some(
    (run) =>
      run.coldInputMs === null ||
      run.warmInputMs === null ||
      run.maximumLongTaskMs === null,
  );
  return { status: hasUnsupportedTiming ? "inconclusive" : "pass", findings: [] };
}
