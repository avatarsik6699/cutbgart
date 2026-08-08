import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  evaluatePhase38Performance,
  type Phase38PerformanceRun,
} from "../../../src/editor/testing/performance";
import {
  assertPrivacySafeReadinessValue,
  PHASE_38_READINESS_SCHEMA_VERSION,
  type EvidenceKind,
  type ParityRequirement,
  type Phase38ReadinessReport,
} from "../../../src/editor/testing/readiness";

type Bundle = Phase38ReadinessReport & {
  performance: {
    schemaVersion: "phase-38.performance.v1";
    evaluation: "pass" | "inconclusive" | "fail";
    runs: Phase38PerformanceRun[];
  };
};

const REQUIRED_REQUIREMENT_IDS = [
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
  "LEGACY-01",
  "LEGACY-02",
  "LEGACY-03",
  "LIFE-01",
  "LIFE-02",
  "LIFE-03",
  "PRIV-01",
  "RECOV-01",
  "RES-01",
  "RESP-01",
  "RESP-02",
  "TOOL-01",
  "TOOL-02",
  "TOOL-03",
  "TOOL-04",
] as const;
const REQUIRED_EVIDENCE_KINDS = [
  "architect",
  "automated",
  "real-model",
  "target-device",
] satisfies readonly EvidenceKind[];

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

function assertRequirement(requirement: ParityRequirement): void {
  assert.deepEqual(sorted(requirement.locales), ["en", "ru"]);
  assert.notEqual(requirement.outcome.trim(), "");
  assert.notEqual(requirement.rationale.trim(), "");
  assert.ok(requirement.evidenceIds.length > 0);
  assert.ok(
    ["required-parity", "accepted-difference", "cutover-blocker"].includes(
      requirement.disposition,
    ),
  );
  assert.ok(["passed", "failed", "unsupported"].includes(requirement.status));
}

const reportPath = path.resolve("docs/archive/audits/phases-33-43/PHASE_38_REPORTS.json");
const value = JSON.parse(await readFile(reportPath, "utf8")) as Bundle;
assert.equal(value.schemaVersion, PHASE_38_READINESS_SCHEMA_VERSION);
assert.equal(value.conclusion, "blocked");
assert.ok(Number.isFinite(Date.parse(value.generatedAt)));
assert.equal(value.requirements.length, REQUIRED_REQUIREMENT_IDS.length);
assert.deepEqual(
  sorted(value.requirements.map((requirement) => requirement.id)),
  sorted(REQUIRED_REQUIREMENT_IDS),
);
assert.equal(new Set(value.requirements.map((requirement) => requirement.id)).size, 31);
value.requirements.forEach(assertRequirement);
const expectedBlockerIds = value.requirements
  .filter(
    (requirement) =>
      requirement.disposition === "cutover-blocker" || requirement.status !== "passed",
  )
  .map((requirement) => requirement.id);
assert.deepEqual(sorted(value.blockerIds), sorted(expectedBlockerIds));
assert.deepEqual(sorted(value.evidenceKinds), sorted(REQUIRED_EVIDENCE_KINDS));
assert.deepEqual(value.seriousAccessibilityFindingIds, []);
assert.ok(value.limitations.length > 0);
const readinessReport: Phase38ReadinessReport = {
  schemaVersion: value.schemaVersion,
  generatedAt: value.generatedAt,
  conclusion: value.conclusion,
  requirements: value.requirements,
  blockerIds: value.blockerIds,
  seriousAccessibilityFindingIds: value.seriousAccessibilityFindingIds,
  evidenceKinds: value.evidenceKinds,
  limitations: value.limitations,
};
assertPrivacySafeReadinessValue(readinessReport);

assert.equal(value.performance.schemaVersion, "phase-38.performance.v1");
const evaluation = evaluatePhase38Performance(value.performance.runs);
assert.notEqual(evaluation.status, "fail", evaluation.findings.join("; "));
assert.equal(value.performance.evaluation, evaluation.status);
assert.equal(value.performance.runs.length, 3);
console.log(
  `PASS ${reportPath}: ${String(value.requirements.length)} readiness requirements; ${String(value.performance.runs.length)} performance/resource runs (${evaluation.status})`,
);
