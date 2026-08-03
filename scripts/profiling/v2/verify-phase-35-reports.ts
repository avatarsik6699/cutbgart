import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

type ResourceCounts = {
  artifacts: number;
  leases: number;
  objectUrls: number;
};

type TimingSample = {
  support: "supported" | "unsupported";
  samplesMs: number[];
};

type Phase35Report = {
  schemaVersion: "phase-35.magic-cutout.v1";
  run: { id: string; environmentKind: string };
  automaticInferenceCount: number;
  magicPredictionCount: number;
  magicCommitCount: number;
  explicitApplyOnly: boolean;
  draftBounds: {
    maximumStrokes: number;
    maximumPointsPerStroke: number;
    maximumUndoEntries: number;
  };
  resourcesAfterReset: ResourceCounts;
  timings: {
    firstPrediction: TimingSample;
    warmPrediction: TimingSample;
    interaction: TimingSample;
    longTasksMs: number[];
  };
  missedActions: number;
  limitations: string[];
};

const reportPath = path.resolve("docs/audits/PHASE_35_REPORTS.json");
const value: unknown = JSON.parse(await readFile(reportPath, "utf8"));
assert(Array.isArray(value), "Phase-35 report bundle must be an array");
assert.equal(
  value.length,
  3,
  "Expected mocked, host real-model, and Windows target reports",
);

const reports = value as Phase35Report[];
for (const report of reports) {
  assert.equal(report.schemaVersion, "phase-35.magic-cutout.v1");
  assert.equal(
    report.automaticInferenceCount,
    1,
    `${report.run.id}: automatic inference count drifted`,
  );
  assert.equal(
    report.magicPredictionCount,
    2,
    `${report.run.id}: refine/re-predict evidence is incomplete`,
  );
  assert.equal(report.magicCommitCount, 1, `${report.run.id}: Apply was not singular`);
  assert.equal(
    report.explicitApplyOnly,
    true,
    `${report.run.id}: implicit commit observed`,
  );
  assert.deepEqual(report.draftBounds, {
    maximumStrokes: 50,
    maximumPointsPerStroke: 512,
    maximumUndoEntries: 50,
  });
  assert.deepEqual(report.resourcesAfterReset, {
    artifacts: 0,
    leases: 0,
    objectUrls: 0,
  });
  assert.equal(report.missedActions, 0, `${report.run.id}: missed action observed`);
  assert(Array.isArray(report.limitations));

  for (const timing of [
    report.timings.firstPrediction,
    report.timings.warmPrediction,
    report.timings.interaction,
  ]) {
    assert(
      timing.samplesMs.every((sample) => Number.isFinite(sample) && sample >= 0),
      `${report.run.id}: invalid timing sample`,
    );
    if (timing.support === "unsupported") {
      assert.equal(timing.samplesMs.length, 0);
      assert(
        report.limitations.length > 0,
        `${report.run.id}: unsupported signal lacks a limitation`,
      );
    }
  }
}

const byId = new Map(reports.map((report) => [report.run.id, report]));
assert.deepEqual(
  new Set(byId.keys()),
  new Set(["mocked-browser", "host-real-model", "windows-target"]),
);
assert.deepEqual(byId.get("windows-target")?.timings.firstPrediction.samplesMs, [10_000]);
assert.deepEqual(byId.get("windows-target")?.timings.warmPrediction.samplesMs, [347]);
assert.deepEqual(byId.get("windows-target")?.timings.interaction.samplesMs, [27, 27, 34]);
assert.deepEqual(byId.get("windows-target")?.timings.longTasksMs, [55]);

console.log(`PASS ${reportPath}: ${reports.length} versioned reports`);
