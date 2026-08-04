import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

type Report = {
  schemaVersion: "phase-37.batch-workspace.v1";
  run: { id: "mocked-browser" | "host-real-model" | "windows-target" };
  documentCount: number;
  maximumImportPreparations: number;
  maximumHeavyJobs: number;
  automaticInferenceCount: number | null;
  cachedSelectionInferenceCount: number | null;
  zipIncludedCount: number;
  resourcesAfterChurn: { artifacts: number; leases: number; objectUrls: number };
  limitations: string[];
};

const reportPath = path.resolve("docs/audits/PHASE_37_REPORTS.json");
const value: unknown = JSON.parse(await readFile(reportPath, "utf8"));
assert(Array.isArray(value));
assert.equal(value.length, 3, "Expected mocked, host real-model, and Windows reports");
const reports = value as Report[];
for (const report of reports) {
  assert.equal(report.schemaVersion, "phase-37.batch-workspace.v1");
  assert(report.documentCount >= 3);
  assert(report.maximumImportPreparations <= 2);
  assert.equal(report.maximumHeavyJobs, 1);
  if (report.automaticInferenceCount === null)
    assert(report.limitations.some((value) => value.includes("worker-message")));
  else assert(report.automaticInferenceCount >= 3);
  if (report.cachedSelectionInferenceCount !== null)
    assert.equal(report.cachedSelectionInferenceCount, 0);
  assert(report.zipIncludedCount >= 2);
  assert.deepEqual(report.resourcesAfterChurn, {
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
  assert(report.limitations.length > 0);
}
assert.deepEqual(
  new Set(reports.map((report) => report.run.id)),
  new Set(["mocked-browser", "host-real-model", "windows-target"]),
);
console.log(`PASS ${reportPath}: ${String(reports.length)} versioned reports`);
