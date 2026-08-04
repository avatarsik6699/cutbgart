export const PHASE_38_READINESS_SCHEMA_VERSION = 1 as const;

export type ParityDisposition =
  "required-parity" | "accepted-difference" | "cutover-blocker";
export type ReadinessConclusion = "ready" | "blocked";
export type EvidenceKind = "automated" | "real-model" | "target-device" | "architect";
export type EvidenceStatus = "passed" | "failed" | "unsupported";
export type AccessibilityImpact = "minor" | "moderate" | "serious" | "critical";

export type ReadinessEvidence = Readonly<{
  id: string;
  kind: EvidenceKind;
  capturedAt: string;
  status: EvidenceStatus;
  limitation: string | null;
}>;

export type ParityRequirement = Readonly<{
  id: string;
  locales: readonly ("ru" | "en")[];
  outcome: string;
  disposition: ParityDisposition;
  rationale: string;
  evidenceIds: readonly string[];
  status: EvidenceStatus;
}>;

export type AccessibilityFinding = Readonly<{
  id: string;
  impact: AccessibilityImpact;
  resolved: boolean;
  evidenceIds: readonly string[];
}>;

export type Phase38ReadinessReport = Readonly<{
  schemaVersion: typeof PHASE_38_READINESS_SCHEMA_VERSION;
  generatedAt: string;
  conclusion: ReadinessConclusion;
  requirements: readonly ParityRequirement[];
  blockerIds: readonly string[];
  seriousAccessibilityFindingIds: readonly string[];
  evidenceKinds: readonly EvidenceKind[];
  limitations: readonly string[];
}>;

export type BuildPhase38ReadinessReportInput = Readonly<{
  generatedAt: string;
  maximumEvidenceAgeMs: number;
  requiredRequirementIds: readonly string[];
  requiredEvidenceKinds: readonly EvidenceKind[];
  requirements: readonly ParityRequirement[];
  evidence: readonly ReadinessEvidence[];
  accessibilityFindings: readonly AccessibilityFinding[];
}>;
