import { evaluatePerformanceBudget } from "./evaluate";
import type { StageMarkRegistry } from "./stage-registry";
import {
  PERFORMANCE_REPORT_SCHEMA_VERSION,
  type ArtifactSample,
  type InteractionSample,
  type LongTaskSample,
  type PerformanceBudgets,
  type PerformanceReportV1,
  type ResourceSample,
} from "./report";

export type PerformanceScenarioAdapter = {
  nowIso(): string;
  environment(): PerformanceReportV1["environment"];
  support(): PerformanceReportV1["support"];
  interactions(): readonly InteractionSample[];
  longTasks(): readonly LongTaskSample[];
  resources(): readonly ResourceSample[];
  artifacts(): readonly ArtifactSample[];
  limitations(): readonly string[];
};

export function assemblePerformanceReport(input: {
  run: PerformanceReportV1["run"];
  adapter: PerformanceScenarioAdapter;
  stages: StageMarkRegistry;
  budgets?: PerformanceBudgets;
}): PerformanceReportV1 {
  input.stages.assertNoActiveStages();
  const support = input.adapter.support();
  const interactions = [...input.adapter.interactions()];
  const longTasks = [...input.adapter.longTasks()];
  const artifacts = [...input.adapter.artifacts()];
  return {
    schemaVersion: PERFORMANCE_REPORT_SCHEMA_VERSION,
    capturedAt: input.adapter.nowIso(),
    run: input.run,
    environment: input.adapter.environment(),
    support,
    stages: input.stages.samples(),
    interactions,
    longTasks,
    resources: [...input.adapter.resources()],
    artifacts,
    evaluation: evaluatePerformanceBudget({
      support,
      interactions,
      longTasks,
      artifacts,
      ...(input.budgets ? { budgets: input.budgets } : {}),
    }),
    limitations: [...input.adapter.limitations()],
  };
}

export class DeterministicPerformanceAdapter implements PerformanceScenarioAdapter {
  #capturedAt = "2026-08-01T00:00:00.000Z";
  #environment: PerformanceReportV1["environment"] = {
    browser: "deterministic",
    platform: "test",
    gpuPath: null,
  };
  #support: PerformanceReportV1["support"] = {
    userTiming: "supported",
    longTasks: "supported",
    eventTiming: "supported",
    resources: "supported",
  };
  #interactions: InteractionSample[] = [];
  #longTasks: LongTaskSample[] = [];
  #resources: ResourceSample[] = [];
  #artifacts: ArtifactSample[] = [];
  #limitations: string[] = [];

  with(input: {
    capturedAt?: string;
    environment?: PerformanceReportV1["environment"];
    support?: PerformanceReportV1["support"];
    interactions?: InteractionSample[];
    longTasks?: LongTaskSample[];
    resources?: ResourceSample[];
    artifacts?: ArtifactSample[];
    limitations?: string[];
  }): this {
    if (input.capturedAt) this.#capturedAt = input.capturedAt;
    if (input.environment) this.#environment = structuredClone(input.environment);
    if (input.support) this.#support = structuredClone(input.support);
    if (input.interactions) this.#interactions = structuredClone(input.interactions);
    if (input.longTasks) this.#longTasks = structuredClone(input.longTasks);
    if (input.resources) this.#resources = structuredClone(input.resources);
    if (input.artifacts) this.#artifacts = structuredClone(input.artifacts);
    if (input.limitations) this.#limitations = [...input.limitations];
    return this;
  }

  nowIso() {
    return this.#capturedAt;
  }
  environment() {
    return structuredClone(this.#environment);
  }
  support() {
    return structuredClone(this.#support);
  }
  interactions() {
    return structuredClone(this.#interactions);
  }
  longTasks() {
    return structuredClone(this.#longTasks);
  }
  resources() {
    return structuredClone(this.#resources);
  }
  artifacts() {
    return structuredClone(this.#artifacts);
  }
  limitations() {
    return [...this.#limitations];
  }
}
