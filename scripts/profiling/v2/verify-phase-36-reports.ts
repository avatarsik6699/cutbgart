import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

type TimingSample = {
  support: "supported" | "unsupported";
  samplesMs: number[];
};

type Phase36Report = {
  schemaVersion: "phase-36.finishing-tools.v1";
  run: { id: string; environmentKind: string };
  automaticInferenceCount: number;
  backgroundPreparationCount: number;
  backgroundCommitCount: number;
  enhancementOperationRunCount: number;
  enhancementCommitCount: number | null;
  magicPredictionCount: number;
  observedStages: string[];
  resourcesAfterReset: { artifacts: number; leases: number; objectUrls: number };
  timings: {
    scenarioTotal: TimingSample;
    coldEnhancement: TimingSample;
    warmEnhancement: TimingSample;
    backgroundApply: TimingSample;
    interactionEventToPaint: TimingSample;
    longTasksMs: number[];
  };
  missedActions: number;
  limitations: string[];
};

const reportPath = path.resolve("docs/audits/PHASE_36_REPORTS.json");
const value: unknown = JSON.parse(await readFile(reportPath, "utf8"));
assert(Array.isArray(value), "Phase-36 report bundle must be an array");
assert.equal(value.length, 3, "Expected mocked, host real-model, and Windows reports");

const reports = value as Phase36Report[];
for (const report of reports) {
  assert.equal(report.schemaVersion, "phase-36.finishing-tools.v1");
  assert(report.automaticInferenceCount >= 1, `${report.run.id}: no Automatic run`);
  assert.equal(report.backgroundPreparationCount, 1);
  assert.equal(report.backgroundCommitCount, 1);
  assert(report.enhancementOperationRunCount >= 4);
  assert(report.observedStages.includes("enhancement-fine-detail"));
  assert(report.observedStages.includes("enhancement-colour-halo"));
  assert.deepEqual(report.resourcesAfterReset, {
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
  assert.equal(report.missedActions, 0);
  assert(report.limitations.length > 0);

  for (const timing of [
    report.timings.scenarioTotal,
    report.timings.coldEnhancement,
    report.timings.warmEnhancement,
    report.timings.backgroundApply,
    report.timings.interactionEventToPaint,
  ]) {
    assert(timing.samplesMs.every((sample) => Number.isFinite(sample) && sample >= 0));
    if (timing.support === "unsupported") assert.equal(timing.samplesMs.length, 0);
    else assert(timing.samplesMs.length > 0);
  }
  assert(
    report.timings.longTasksMs.every((sample) => Number.isFinite(sample) && sample >= 0),
  );
}

const byId = new Map(reports.map((report) => [report.run.id, report]));
assert.deepEqual(
  new Set(byId.keys()),
  new Set(["mocked-browser", "host-real-model", "windows-target"]),
);
assert.equal(byId.get("windows-target")?.enhancementCommitCount, 2);
assert.equal(byId.get("windows-target")?.magicPredictionCount, 1);
assert.deepEqual(byId.get("windows-target")?.timings.coldEnhancement.samplesMs, [64_711]);
assert.deepEqual(byId.get("windows-target")?.timings.warmEnhancement.samplesMs, [18_711]);
assert.equal(byId.get("host-real-model")?.enhancementCommitCount, null);

console.log(`PASS ${reportPath}: ${String(reports.length)} versioned reports`);
