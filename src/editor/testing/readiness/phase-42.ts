import type {
  AccessibilityFinding,
  BuildPhase38ReadinessReportInput,
  EvidenceKind,
  ParityRequirement,
  ReadinessConclusion,
  ReadinessEvidence,
} from "./contracts";
import { assertPrivacySafeReadinessValue, buildPhase38ReadinessReport } from "./evaluate";

export const PHASE_42_READINESS_SCHEMA_VERSION = "phase-42.readiness.v1" as const;

export type BuildPhase42ReadinessReportInput = BuildPhase38ReadinessReportInput;

export type Phase42ReadinessReport = Readonly<{
  schemaVersion: typeof PHASE_42_READINESS_SCHEMA_VERSION;
  generatedAt: string;
  maximumEvidenceAgeMs: number;
  conclusion: ReadinessConclusion;
  requirements: readonly ParityRequirement[];
  evidence: readonly ReadinessEvidence[];
  accessibilityFindings: readonly AccessibilityFinding[];
  blockerIds: readonly string[];
  unsupportedSignalIds: readonly string[];
  seriousAccessibilityFindingIds: readonly string[];
  evidenceKinds: readonly EvidenceKind[];
  limitations: readonly string[];
}>;

export function buildPhase42ReadinessReport(
  input: BuildPhase42ReadinessReportInput,
): Phase42ReadinessReport {
  const validated = buildPhase38ReadinessReport(input);
  const report: Phase42ReadinessReport = {
    schemaVersion: PHASE_42_READINESS_SCHEMA_VERSION,
    generatedAt: validated.generatedAt,
    maximumEvidenceAgeMs: input.maximumEvidenceAgeMs,
    conclusion: validated.conclusion,
    requirements: validated.requirements,
    evidence: [...input.evidence].sort((left, right) => left.id.localeCompare(right.id)),
    accessibilityFindings: [...input.accessibilityFindings].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    blockerIds: validated.blockerIds,
    unsupportedSignalIds: input.requirements
      .filter((requirement) => requirement.status === "unsupported")
      .map((requirement) => requirement.id)
      .sort(),
    seriousAccessibilityFindingIds: validated.seriousAccessibilityFindingIds,
    evidenceKinds: validated.evidenceKinds,
    limitations: validated.limitations,
  };
  assertPrivacySafeReadinessValue(report);
  return report;
}
