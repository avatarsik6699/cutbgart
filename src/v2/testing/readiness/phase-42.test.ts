import { describe, expect, it } from "vitest";

import type {
  AccessibilityFinding,
  EvidenceKind,
  ParityRequirement,
  ReadinessEvidence,
} from "./contracts";
import {
  buildPhase42ReadinessReport,
  PHASE_42_READINESS_SCHEMA_VERSION,
} from "./phase-42";

const generatedAt = "2026-08-05T12:00:00.000Z";
const requiredEvidenceKinds = [
  "architect",
  "automated",
  "real-model",
  "target-device",
] satisfies readonly EvidenceKind[];

function evidence(
  id: string,
  kind: EvidenceKind,
  status: ReadinessEvidence["status"] = "passed",
): ReadinessEvidence {
  return {
    id,
    kind,
    capturedAt: generatedAt,
    status,
    limitation: status === "unsupported" ? "Current signal is pending." : null,
  };
}

function requirement(
  id: string,
  evidenceIds: readonly string[],
  status: ParityRequirement["status"] = "passed",
): ParityRequirement {
  return {
    id,
    locales: ["ru", "en"],
    outcome: "The observable outcome passes in both locales.",
    disposition: "required-parity",
    rationale: "The complete-product contract requires this outcome.",
    evidenceIds,
    status,
  };
}

function accessibilityFinding(
  overrides: Partial<AccessibilityFinding> = {},
): AccessibilityFinding {
  return {
    id: "AXE-01",
    impact: "minor",
    resolved: false,
    evidenceIds: ["A-current"],
    ...overrides,
  };
}

describe("Phase 42 readiness evidence", () => {
  it("versions and preserves the evidence needed to reproduce a ready decision", () => {
    const report = buildPhase42ReadinessReport({
      generatedAt,
      maximumEvidenceAgeMs: 60_000,
      requiredRequirementIds: ["INPUT-01"],
      requiredEvidenceKinds,
      requirements: [requirement("INPUT-01", ["A-current"])],
      evidence: [
        evidence("W-current", "target-device"),
        evidence("A-current", "automated"),
        evidence("H-current", "architect"),
        evidence("R-current", "real-model"),
      ],
      accessibilityFindings: [accessibilityFinding()],
    });

    expect(report).toMatchObject({
      schemaVersion: PHASE_42_READINESS_SCHEMA_VERSION,
      conclusion: "ready",
      maximumEvidenceAgeMs: 60_000,
      blockerIds: [],
      unsupportedSignalIds: [],
      seriousAccessibilityFindingIds: [],
    });
    expect(report.evidence.map((record) => record.id)).toEqual([
      "A-current",
      "H-current",
      "R-current",
      "W-current",
    ]);
  });

  it("fails closed and aggregates unsupported signals and serious findings", () => {
    const report = buildPhase42ReadinessReport({
      generatedAt,
      maximumEvidenceAgeMs: 60_000,
      requiredRequirementIds: ["A11Y-01", "RESP-01"],
      requiredEvidenceKinds,
      requirements: [
        requirement("A11Y-01", ["A-current"]),
        requirement("RESP-01", ["W-current"], "unsupported"),
      ],
      evidence: [
        evidence("A-current", "automated"),
        evidence("H-current", "architect"),
        evidence("R-current", "real-model"),
        evidence("W-current", "target-device", "unsupported"),
      ],
      accessibilityFindings: [
        accessibilityFinding({ impact: "serious", evidenceIds: ["A-current"] }),
      ],
    });

    expect(report.conclusion).toBe("blocked");
    expect(report.blockerIds).toEqual(["RESP-01"]);
    expect(report.unsupportedSignalIds).toEqual(["RESP-01"]);
    expect(report.seriousAccessibilityFindingIds).toEqual(["AXE-01"]);
  });

  it.each([
    ["stale evidence", "2026-08-05T10:00:00.000Z"],
    ["future evidence", "2026-08-05T13:00:00.000Z"],
  ])("rejects %s", (_label, capturedAt) => {
    expect(() =>
      buildPhase42ReadinessReport({
        generatedAt,
        maximumEvidenceAgeMs: 60_000,
        requiredRequirementIds: ["INPUT-01"],
        requiredEvidenceKinds,
        requirements: [requirement("INPUT-01", ["A-current"])],
        evidence: [
          { ...evidence("A-current", "automated"), capturedAt },
          evidence("H-current", "architect"),
          evidence("R-current", "real-model"),
          evidence("W-current", "target-device"),
        ],
        accessibilityFindings: [],
      }),
    ).toThrow(/stale or from the future/);
  });
});
