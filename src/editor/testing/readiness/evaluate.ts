import type {
  AccessibilityFinding,
  BuildPhase38ReadinessReportInput,
  EvidenceKind,
  ParityRequirement,
  Phase38ReadinessReport,
  ReadinessEvidence,
} from "./contracts";
import { PHASE_38_READINESS_SCHEMA_VERSION } from "./contracts";

const FORBIDDEN_METADATA_KEY =
  /^(file(name)?|image|prompt|stroke|colou?r|pixel|url|blob|draft|history|zip)$/i;
const FORBIDDEN_METADATA_VALUE =
  /(?:blob:|data:image|https?:\/\/|[A-Za-z]:\\|\/[\w.-]+\/[^\s]+\.(?:png|jpe?g|webp))/i;

function uniqueMap<T extends Readonly<{ id: string }>>(
  values: readonly T[],
  label: string,
): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    if (value.id.trim() === "") throw new Error(`${label} contains an empty id`);
    if (result.has(value.id))
      throw new Error(`${label} contains duplicate id ${value.id}`);
    result.set(value.id, value);
  }
  return result;
}

function assertExactRequirementSet(
  expectedIds: readonly string[],
  requirements: ReadonlyMap<string, ParityRequirement>,
): void {
  const expected = new Set(expectedIds);
  if (expected.size !== expectedIds.length)
    throw new Error("requiredRequirementIds contains duplicates");
  const missing = expectedIds.filter((id) => !requirements.has(id));
  const unexpected = [...requirements.keys()].filter((id) => !expected.has(id));
  if (missing.length > 0 || unexpected.length > 0)
    throw new Error(
      `readiness requirements are not exhaustive (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"})`,
    );
}

function assertCurrentEvidence(
  evidence: ReadinessEvidence,
  generatedAtMs: number,
  maximumEvidenceAgeMs: number,
): void {
  const capturedAtMs = Date.parse(evidence.capturedAt);
  if (!Number.isFinite(capturedAtMs))
    throw new Error(`evidence ${evidence.id} has an invalid capturedAt`);
  const age = generatedAtMs - capturedAtMs;
  if (age < 0 || age > maximumEvidenceAgeMs)
    throw new Error(`evidence ${evidence.id} is stale or from the future`);
  if (evidence.status === "unsupported" && !evidence.limitation)
    throw new Error(`unsupported evidence ${evidence.id} requires a limitation`);
}

function expectedRequirementStatus(
  requirement: ParityRequirement,
  evidence: ReadonlyMap<string, ReadinessEvidence>,
): ParityRequirement["status"] {
  if (requirement.evidenceIds.length === 0)
    throw new Error(`requirement ${requirement.id} has no evidence`);
  const records = requirement.evidenceIds.map((id) => {
    const record = evidence.get(id);
    if (!record)
      throw new Error(`requirement ${requirement.id} references missing evidence ${id}`);
    return record;
  });
  if (records.some((record) => record.status === "failed")) return "failed";
  if (records.some((record) => record.status === "unsupported")) return "unsupported";
  return "passed";
}

function assertRequirement(
  requirement: ParityRequirement,
  evidence: ReadonlyMap<string, ReadinessEvidence>,
): void {
  if (
    requirement.locales.length !== 2 ||
    !requirement.locales.includes("ru") ||
    !requirement.locales.includes("en")
  )
    throw new Error(`requirement ${requirement.id} must cover ru and en`);
  if (requirement.outcome.trim() === "" || requirement.rationale.trim() === "")
    throw new Error(`requirement ${requirement.id} requires outcome and rationale`);
  const expectedStatus = expectedRequirementStatus(requirement, evidence);
  if (expectedStatus !== requirement.status)
    throw new Error(
      `requirement ${requirement.id} status contradicts evidence (${requirement.status} vs ${expectedStatus})`,
    );
  if (requirement.disposition === "accepted-difference") {
    const hasArchitectEvidence = requirement.evidenceIds.some(
      (id) =>
        evidence.get(id)?.kind === "architect" && evidence.get(id)?.status === "passed",
    );
    if (!hasArchitectEvidence)
      throw new Error(
        `accepted difference ${requirement.id} lacks passing architect evidence`,
      );
  }
}

function unresolvedSeriousFindings(
  findings: readonly AccessibilityFinding[],
  evidence: ReadonlyMap<string, ReadinessEvidence>,
): readonly string[] {
  uniqueMap(findings, "accessibility findings");
  return findings
    .map((finding) => {
      for (const evidenceId of finding.evidenceIds) {
        if (!evidence.has(evidenceId))
          throw new Error(
            `accessibility finding ${finding.id} references missing evidence ${evidenceId}`,
          );
      }
      return finding;
    })
    .filter(
      (finding) =>
        !finding.resolved &&
        (finding.impact === "serious" || finding.impact === "critical"),
    )
    .map((finding) => finding.id)
    .sort();
}

function observedEvidenceKinds(
  evidence: readonly ReadinessEvidence[],
): readonly EvidenceKind[] {
  return [...new Set(evidence.map((record) => record.kind))].sort();
}

export function assertPrivacySafeReadinessValue(value: unknown): void {
  function visit(current: unknown, key: string | null): void {
    if (key !== null && FORBIDDEN_METADATA_KEY.test(key))
      throw new Error(`readiness metadata contains forbidden key ${key}`);
    if (typeof current === "string" && FORBIDDEN_METADATA_VALUE.test(current))
      throw new Error("readiness metadata contains user-content-like value");
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, null));
      return;
    }
    if (current !== null && typeof current === "object") {
      for (const [childKey, child] of Object.entries(current)) visit(child, childKey);
    }
  }
  visit(value, null);
}

export function buildPhase38ReadinessReport(
  input: BuildPhase38ReadinessReportInput,
): Phase38ReadinessReport {
  const generatedAtMs = Date.parse(input.generatedAt);
  if (!Number.isFinite(generatedAtMs)) throw new Error("generatedAt is invalid");
  if (!Number.isFinite(input.maximumEvidenceAgeMs) || input.maximumEvidenceAgeMs < 0)
    throw new Error("maximumEvidenceAgeMs must be a non-negative finite number");
  const requirements = uniqueMap(input.requirements, "requirements");
  const evidence = uniqueMap(input.evidence, "evidence");
  assertExactRequirementSet(input.requiredRequirementIds, requirements);
  for (const record of input.evidence)
    assertCurrentEvidence(record, generatedAtMs, input.maximumEvidenceAgeMs);
  for (const requirement of input.requirements) assertRequirement(requirement, evidence);

  const kinds = observedEvidenceKinds(input.evidence);
  const missingKinds = input.requiredEvidenceKinds.filter(
    (kind) => !kinds.includes(kind),
  );
  if (missingKinds.length > 0)
    throw new Error(
      `readiness evidence is missing required kinds: ${missingKinds.join(", ")}`,
    );

  const seriousAccessibilityFindingIds = unresolvedSeriousFindings(
    input.accessibilityFindings,
    evidence,
  );
  const blockerIds = input.requirements
    .filter(
      (requirement) =>
        requirement.disposition === "cutover-blocker" || requirement.status !== "passed",
    )
    .map((requirement) => requirement.id)
    .sort();
  const limitations = [
    ...new Set(input.evidence.flatMap((record) => record.limitation ?? [])),
  ].sort();
  const report: Phase38ReadinessReport = {
    schemaVersion: PHASE_38_READINESS_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    conclusion:
      blockerIds.length === 0 && seriousAccessibilityFindingIds.length === 0
        ? "ready"
        : "blocked",
    requirements: [...input.requirements].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    blockerIds,
    seriousAccessibilityFindingIds,
    evidenceKinds: kinds,
    limitations,
  };
  assertPrivacySafeReadinessValue(report);
  return report;
}
