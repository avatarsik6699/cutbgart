import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  evaluatePhase42Performance,
  PHASE_42_PERFORMANCE_SCHEMA_VERSION,
  type Phase42PerformanceRun,
} from "../../../src/v2/testing/performance";
import {
  assertPrivacySafeReadinessValue,
  buildPhase42ReadinessReport,
  PHASE_42_READINESS_SCHEMA_VERSION,
  type Phase42ReadinessReport,
} from "../../../src/v2/testing/readiness";

type Bundle = Phase42ReadinessReport & {
  performance: {
    schemaVersion: typeof PHASE_42_PERFORMANCE_SCHEMA_VERSION;
    evaluation: "pass" | "inconclusive" | "fail";
    runs: Phase42PerformanceRun[];
  };
};

const REQUIRED_REQUIREMENT_IDS = [
  "ACCEPT-01",
  "A11Y-01",
  "A11Y-02",
  "A11Y-03",
  "A11Y-04",
  "A11Y-05",
  "AUTO-01",
  "AUTO-02",
  "COPY-01",
  "EXPORT-01",
  "EXPORT-02",
  "HIST-01",
  "INPUT-01",
  "INPUT-02",
  "INPUT-03",
  "INPUT-04",
  "INPUT-05",
  "LIFE-01",
  "LIFE-02",
  "LIFE-03",
  "PARITY-01",
  "PERF-01",
  "PRIV-01",
  "RECOV-01",
  "RES-01",
  "RESP-01",
  "RESP-02",
  "TOOL-01",
  "TOOL-02",
  "TOOL-03",
  "TOOL-04",
  "TOOL-05",
] as const;
const REQUIRED_EVIDENCE_KINDS = [
  "architect",
  "automated",
  "real-model",
  "target-device",
] as const;

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

const reportPath = path.resolve("docs/audits/PHASE_42_REPORTS.json");
const value = JSON.parse(await readFile(reportPath, "utf8")) as Bundle;
assert.equal(value.schemaVersion, PHASE_42_READINESS_SCHEMA_VERSION);
assert.equal(value.performance.schemaVersion, PHASE_42_PERFORMANCE_SCHEMA_VERSION);
assert.ok(Number.isFinite(Date.parse(value.generatedAt)));
assert.equal(value.requirements.length, REQUIRED_REQUIREMENT_IDS.length);
assert.deepEqual(
  sorted(value.requirements.map((requirement) => requirement.id)),
  sorted(REQUIRED_REQUIREMENT_IDS),
);
assert.equal(
  new Set(value.requirements.map((requirement) => requirement.id)).size,
  REQUIRED_REQUIREMENT_IDS.length,
);

const rebuilt = buildPhase42ReadinessReport({
  generatedAt: value.generatedAt,
  maximumEvidenceAgeMs: value.maximumEvidenceAgeMs,
  requiredRequirementIds: REQUIRED_REQUIREMENT_IDS,
  requiredEvidenceKinds: REQUIRED_EVIDENCE_KINDS,
  requirements: value.requirements,
  evidence: value.evidence,
  accessibilityFindings: value.accessibilityFindings,
});
assert.equal(value.conclusion, rebuilt.conclusion);
assert.deepEqual(sorted(value.blockerIds), sorted(rebuilt.blockerIds));
assert.deepEqual(
  sorted(value.unsupportedSignalIds),
  sorted(rebuilt.unsupportedSignalIds),
);
assert.deepEqual(
  sorted(value.seriousAccessibilityFindingIds),
  sorted(rebuilt.seriousAccessibilityFindingIds),
);
assert.deepEqual(sorted(value.evidenceKinds), sorted(rebuilt.evidenceKinds));
assert.deepEqual(sorted(value.limitations), sorted(rebuilt.limitations));
assertPrivacySafeReadinessValue(value);

const performance = evaluatePhase42Performance(value.performance.runs);
assert.equal(value.performance.evaluation, performance.status);
if (value.conclusion === "ready") {
  assert.equal(value.blockerIds.length, 0);
  assert.equal(value.unsupportedSignalIds.length, 0);
  assert.equal(value.seriousAccessibilityFindingIds.length, 0);
  assert.equal(performance.status, "pass", performance.findings.join("; "));
}

console.log(
  `PASS ${reportPath}: ${String(value.requirements.length)} complete-product requirements; ${String(value.performance.runs.length)} performance/resource runs; conclusion ${value.conclusion}`,
);
