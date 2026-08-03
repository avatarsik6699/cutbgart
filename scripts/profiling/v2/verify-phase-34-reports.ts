import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

type ResourceCounts = {
  artifacts: number;
  leases: number;
  objectUrls: number;
};

type Phase34Report = {
  schemaVersion: "phase-34.manual-cutout.v1";
  run: { id: string; environmentKind: string };
  automaticInferenceCount: number;
  manualCommitCount: number;
  exportSucceeded: boolean | null;
  history: { requestedOperations: number; retainedOperations: number };
  resourcesAfterReset: ResourceCounts;
  actionPaintLatency: {
    support: "supported" | "unsupported";
    samplesMs: number[];
  };
  missedActions: number;
  limitations: string[];
};

const reportPath = path.resolve("docs/audits/PHASE_34_REPORTS.json");
const value: unknown = JSON.parse(await readFile(reportPath, "utf8"));
assert(Array.isArray(value), "Phase-34 report bundle must be an array");
assert.equal(
  value.length,
  3,
  "Expected mocked churn, host real-model, and target-device reports",
);

const reports = value as Phase34Report[];
for (const report of reports) {
  assert.equal(report.schemaVersion, "phase-34.manual-cutout.v1");
  assert.equal(
    report.automaticInferenceCount,
    1,
    `${report.run.id}: Manual flow reinferred`,
  );
  assert.equal(report.missedActions, 0, `${report.run.id}: missed action observed`);
  assert(
    report.history.retainedOperations <= 20,
    `${report.run.id}: operation cap exceeded`,
  );
  assert.deepEqual(report.resourcesAfterReset, {
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
  assert(Array.isArray(report.limitations));
  if (report.actionPaintLatency.support === "unsupported") {
    assert.equal(report.actionPaintLatency.samplesMs.length, 0);
    assert(
      report.limitations.length > 0,
      `${report.run.id}: unsupported signal lacks limitation`,
    );
  }
}

const byId = new Map(reports.map((report) => [report.run.id, report]));
assert.equal(byId.get("mocked-history-churn")?.manualCommitCount, 22);
assert.equal(byId.get("mocked-history-churn")?.exportSucceeded, true);
assert.deepEqual(byId.get("mocked-history-churn")?.history, {
  requestedOperations: 22,
  retainedOperations: 20,
});
assert.equal(byId.get("host-real-model")?.manualCommitCount, 1);
assert.equal(byId.get("host-real-model")?.exportSucceeded, true);
assert.equal(byId.get("windows-target")?.manualCommitCount, 1);
assert.equal(byId.get("windows-target")?.exportSucceeded, null);

console.log(`PASS ${reportPath}: ${reports.length} versioned reports`);
