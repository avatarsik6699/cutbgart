import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  evaluatePerformanceBudget,
  isPerformanceReportV1,
  type PerformanceReportV1,
} from "../../../src/v2/testing/performance/index";

const reportPath = path.resolve("docs/audits/PHASE_33_REPORTS.json");
const value: unknown = JSON.parse(await readFile(reportPath, "utf8"));

assert(Array.isArray(value), "Phase-33 report bundle must be an array");
assert.equal(value.length, 3, "Expected fake plus cold and warm real-model reports");

const reports: PerformanceReportV1[] = [];
for (const candidate of value) {
  assert(isPerformanceReportV1(candidate), "Invalid phase-33.performance.v1 report");
  const report = candidate;
  reports.push(report);
  const evaluation = evaluatePerformanceBudget({
    support: report.support,
    interactions: report.interactions,
    longTasks: report.longTasks,
    artifacts: report.artifacts,
  });
  assert.deepEqual(report.evaluation, evaluation, `${report.run.id}: stale evaluation`);
  assert.equal(report.evaluation.status, "pass", `${report.run.id}: budget did not pass`);
}

const runs = new Set(reports.map((report) => report.run.id));
assert.deepEqual(
  runs,
  new Set(["fake-automated", "target-real-cold", "target-real-warm"]),
);

console.log(`PASS ${reportPath}: ${value.length} versioned reports`);
