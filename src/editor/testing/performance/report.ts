export const PERFORMANCE_REPORT_SCHEMA_VERSION = "phase-33.performance.v1" as const;

export type PerformanceGatewayKind = "fake" | "real-model";
export type PerformanceEnvironmentKind = "automated-host" | "target-device";
export type CacheState = "cold" | "warm" | "not-applicable";
export type MetricSupport = "supported" | "unsupported" | "unknown";

export type PerformanceSupport = {
  userTiming: MetricSupport;
  longTasks: MetricSupport;
  eventTiming: MetricSupport;
  resources: MetricSupport;
};

export type PerformanceStage =
  | "queued"
  | "worker-transfer"
  | "decode"
  | "model-load"
  | "inference"
  | "post-process"
  | "composite"
  | "encode"
  | "commit"
  | "preview-paint";

export type StageSample = {
  runId: string;
  stage: PerformanceStage;
  startedAtMs: number;
  durationMs: number;
};

export type InteractionSample = {
  name: string;
  kind: "pointer" | "scroll" | "control" | "import";
  eventToNextPaintMs: number | null;
  missed: boolean;
};

export type LongTaskSample = {
  startedAtMs: number;
  durationMs: number;
  attribution: "application" | "browser-or-unknown";
};

export type ResourceSample = {
  name: string;
  kind: "model" | "worker" | "image" | "other";
  transferSize: number | null;
  decodedBodySize: number | null;
  source: "network" | "cache" | "unknown";
};

export type ArtifactSample = {
  point: string;
  artifactCount: number;
  leaseCount: number;
  byteCount: number;
  objectUrlCount: number;
  workerCount: number | null;
  sessionCount: number | null;
  listenerCount: number | null;
};

export type PerformanceBudgets = {
  maximumLongTaskMs: number;
  interactionP95Ms: number;
  maximumMissedActions: number;
  maximumFinalArtifactCount: number;
  maximumFinalLeaseCount: number;
};

export type BudgetCheck = {
  name: keyof PerformanceBudgets;
  status: "pass" | "fail" | "inconclusive";
  observed: number | null;
  budget: number;
  detail?: string;
};

export type PerformanceEvaluation = {
  status: "pass" | "fail" | "inconclusive";
  checks: BudgetCheck[];
};

export type PerformanceReportV1 = {
  schemaVersion: typeof PERFORMANCE_REPORT_SCHEMA_VERSION;
  capturedAt: string;
  run: {
    id: string;
    gateway: PerformanceGatewayKind;
    environmentKind: PerformanceEnvironmentKind;
    cacheState: CacheState;
  };
  environment: {
    browser: string;
    platform: string;
    gpuPath: string | null;
  };
  support: PerformanceSupport;
  stages: StageSample[];
  interactions: InteractionSample[];
  longTasks: LongTaskSample[];
  resources: ResourceSample[];
  artifacts: ArtifactSample[];
  evaluation: PerformanceEvaluation;
  limitations: string[];
};

export const PERFORMANCE_REPORT_V1_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://cutbg.art/schemas/phase-33-performance-v1.json",
  type: "object",
  required: [
    "schemaVersion",
    "capturedAt",
    "run",
    "environment",
    "support",
    "stages",
    "interactions",
    "longTasks",
    "resources",
    "artifacts",
    "evaluation",
    "limitations",
  ],
  properties: {
    schemaVersion: { const: PERFORMANCE_REPORT_SCHEMA_VERSION },
    capturedAt: { type: "string" },
    run: { type: "object" },
    environment: { type: "object" },
    support: { type: "object" },
    stages: { type: "array" },
    interactions: { type: "array" },
    longTasks: { type: "array" },
    resources: { type: "array" },
    artifacts: { type: "array" },
    evaluation: { type: "object" },
    limitations: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
} as const;

export function isPerformanceReportV1(value: unknown): value is PerformanceReportV1 {
  if (typeof value !== "object" || value === null) return false;
  const report = value as Partial<PerformanceReportV1>;
  return (
    report.schemaVersion === PERFORMANCE_REPORT_SCHEMA_VERSION &&
    typeof report.capturedAt === "string" &&
    typeof report.run === "object" &&
    typeof report.environment === "object" &&
    typeof report.support === "object" &&
    Array.isArray(report.stages) &&
    Array.isArray(report.interactions) &&
    Array.isArray(report.longTasks) &&
    Array.isArray(report.resources) &&
    Array.isArray(report.artifacts) &&
    typeof report.evaluation === "object" &&
    Array.isArray(report.limitations)
  );
}
