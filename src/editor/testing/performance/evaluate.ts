import type {
  ArtifactSample,
  BudgetCheck,
  InteractionSample,
  LongTaskSample,
  PerformanceBudgets,
  PerformanceEvaluation,
  PerformanceSupport,
} from "./report";

export const PHASE_33_PERFORMANCE_BUDGETS: PerformanceBudgets = {
  maximumLongTaskMs: 50,
  interactionP95Ms: 100,
  maximumMissedActions: 0,
  maximumFinalArtifactCount: 0,
  maximumFinalLeaseCount: 0,
};

export function nearestRankPercentile(
  values: readonly number[],
  percentile: number,
): number | null {
  if (values.length === 0) return null;
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 100) {
    throw new RangeError("Percentile must be greater than 0 and at most 100");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] ?? null;
}

function thresholdCheck(
  name: keyof PerformanceBudgets,
  observed: number,
  budget: number,
  comparison: "less-than" | "at-most",
): BudgetCheck {
  const passed = comparison === "less-than" ? observed < budget : observed <= budget;
  return { name, status: passed ? "pass" : "fail", observed, budget };
}

function unsupportedCheck(
  name: keyof PerformanceBudgets,
  budget: number,
  detail: string,
): BudgetCheck {
  return { name, status: "inconclusive", observed: null, budget, detail };
}

export function evaluatePerformanceBudget(input: {
  support: PerformanceSupport;
  interactions: readonly InteractionSample[];
  longTasks: readonly LongTaskSample[];
  artifacts: readonly ArtifactSample[];
  budgets?: PerformanceBudgets;
}): PerformanceEvaluation {
  const budgets = input.budgets ?? PHASE_33_PERFORMANCE_BUDGETS;
  const interactionDurations = input.interactions.flatMap((sample) =>
    sample.eventToNextPaintMs === null ? [] : [sample.eventToNextPaintMs],
  );
  const interactionP95 = nearestRankPercentile(interactionDurations, 95);
  const missedActions = input.interactions.filter((sample) => sample.missed).length;
  const maximumLongTask = Math.max(0, ...input.longTasks.map((task) => task.durationMs));
  const finalArtifacts = input.artifacts.at(-1);
  const checks: BudgetCheck[] = [];

  checks.push(
    input.support.longTasks !== "supported"
      ? unsupportedCheck(
          "maximumLongTaskMs",
          budgets.maximumLongTaskMs,
          `Long Task metric is ${input.support.longTasks}`,
        )
      : thresholdCheck(
          "maximumLongTaskMs",
          maximumLongTask,
          budgets.maximumLongTaskMs,
          "less-than",
        ),
  );
  checks.push(
    input.support.eventTiming !== "supported" || interactionP95 === null
      ? unsupportedCheck(
          "interactionP95Ms",
          budgets.interactionP95Ms,
          interactionP95 === null
            ? "No event-to-next-paint samples were captured"
            : `Event metric is ${input.support.eventTiming}`,
        )
      : thresholdCheck(
          "interactionP95Ms",
          interactionP95,
          budgets.interactionP95Ms,
          "less-than",
        ),
  );
  checks.push(
    thresholdCheck(
      "maximumMissedActions",
      missedActions,
      budgets.maximumMissedActions,
      "at-most",
    ),
  );
  checks.push(
    finalArtifacts
      ? thresholdCheck(
          "maximumFinalArtifactCount",
          finalArtifacts.artifactCount,
          budgets.maximumFinalArtifactCount,
          "at-most",
        )
      : unsupportedCheck(
          "maximumFinalArtifactCount",
          budgets.maximumFinalArtifactCount,
          "No final artifact sample was captured",
        ),
  );
  checks.push(
    finalArtifacts
      ? thresholdCheck(
          "maximumFinalLeaseCount",
          finalArtifacts.leaseCount,
          budgets.maximumFinalLeaseCount,
          "at-most",
        )
      : unsupportedCheck(
          "maximumFinalLeaseCount",
          budgets.maximumFinalLeaseCount,
          "No final lease sample was captured",
        ),
  );

  let status: PerformanceEvaluation["status"] = "pass";
  if (checks.some((check) => check.status === "fail")) {
    status = "fail";
  } else if (checks.some((check) => check.status === "inconclusive")) {
    status = "inconclusive";
  }

  return {
    status,
    checks,
  };
}
