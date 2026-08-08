import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

type EvidenceKind =
  "architect" | "automated" | "real-model" | "rollback" | "target-device";

type Report = {
  schemaVersion: "phase-43.readiness.v1";
  generatedAt: string;
  conclusion: "ready" | "blocked";
  requirements: Array<{
    id: string;
    status: "passed" | "accepted-disposition" | "blocked";
    evidenceIds: string[];
  }>;
  evidence: Array<{
    id: string;
    kind: EvidenceKind;
    status: "passed" | "accepted" | "failed";
    summary: string;
  }>;
  blockerIds: string[];
  missingEvidenceIds: string[];
  reachableLegacyEntries: string[];
  seriousAccessibilityFindingIds: string[];
  evidenceKinds: EvidenceKind[];
  limitations: string[];
};

const REQUIRED_REQUIREMENT_IDS = [
  "ACCEPT-01",
  "A11Y-01",
  "CUTOVER-01",
  "LEGACY-01",
  "PERF-01",
  "PRIV-01",
  "PUBLIC-01",
  "REAL-01",
  "RELEASE-01",
  "RES-01",
  "ROLLBACK-01",
  "ROUTES-01",
  "SEO-01",
  "WINDOWS-01",
] as const;
const REQUIRED_EVIDENCE_KINDS: EvidenceKind[] = [
  "architect",
  "automated",
  "real-model",
  "rollback",
  "target-device",
];

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

const reportPath = path.resolve("docs/archive/audits/phases-33-43/PHASE_43_REPORTS.json");
const value = JSON.parse(await readFile(reportPath, "utf8")) as Report;

assert.equal(value.schemaVersion, "phase-43.readiness.v1");
assert.ok(Number.isFinite(Date.parse(value.generatedAt)));
assert.deepEqual(
  sorted(value.requirements.map((requirement) => requirement.id)),
  sorted(REQUIRED_REQUIREMENT_IDS),
);
assert.equal(
  new Set(value.requirements.map(({ id }) => id)).size,
  value.requirements.length,
);
assert.deepEqual(sorted(value.evidenceKinds), sorted(REQUIRED_EVIDENCE_KINDS));

const evidenceById = new Map(value.evidence.map((evidence) => [evidence.id, evidence]));
assert.equal(evidenceById.size, value.evidence.length);
for (const requirement of value.requirements) {
  assert.notEqual(requirement.status, "blocked", requirement.id);
  assert.ok(requirement.evidenceIds.length > 0, `${requirement.id} has no evidence`);
  for (const evidenceId of requirement.evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    assert.ok(evidence, `${requirement.id} references missing ${evidenceId}`);
    assert.notEqual(
      evidence.status,
      "failed",
      `${requirement.id} references failed ${evidenceId}`,
    );
  }
}

assert.equal(value.conclusion, "ready");
assert.deepEqual(value.blockerIds, []);
assert.deepEqual(value.missingEvidenceIds, []);
assert.deepEqual(value.reachableLegacyEntries, []);
assert.deepEqual(value.seriousAccessibilityFindingIds, []);

const privacyScan = JSON.stringify(value).toLowerCase();
for (const forbidden of ["data:image", "blob:", "filename", "sourceurl", "source_url"]) {
  assert.equal(
    privacyScan.includes(forbidden),
    false,
    `privacy-unsafe report value: ${forbidden}`,
  );
}

console.log(
  `PASS ${reportPath}: ${String(value.requirements.length)} requirements, zero blockers, conclusion ready`,
);
