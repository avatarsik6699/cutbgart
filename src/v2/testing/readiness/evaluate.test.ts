import { describe, expect, it } from "vitest";

import type {
  BuildPhase38ReadinessReportInput,
  EvidenceKind,
  ParityRequirement,
  ReadinessEvidence,
} from "./contracts";
import { assertPrivacySafeReadinessValue, buildPhase38ReadinessReport } from "./evaluate";

const generatedAt = "2026-08-04T12:00:00.000Z";
const evidenceKinds: readonly EvidenceKind[] = [
  "architect",
  "automated",
  "real-model",
  "target-device",
];

function evidence(
  id: string,
  kind: EvidenceKind,
  status: ReadinessEvidence["status"] = "passed",
): ReadinessEvidence {
  return {
    id,
    kind,
    status,
    capturedAt: generatedAt,
    limitation:
      status === "unsupported" ? "Signal unavailable on this environment." : null,
  };
}

function requirement(overrides: Partial<ParityRequirement> = {}): ParityRequirement {
  return {
    id: "INPUT-01",
    locales: ["ru", "en"],
    outcome: "Picker admits valid images locally.",
    disposition: "required-parity",
    rationale: "The public editor already promises picker input.",
    evidenceIds: ["A-journey"],
    status: "passed",
    ...overrides,
  };
}

function input(
  overrides: Partial<BuildPhase38ReadinessReportInput> = {},
): BuildPhase38ReadinessReportInput {
  return {
    generatedAt,
    maximumEvidenceAgeMs: 60_000,
    requiredRequirementIds: ["INPUT-01"],
    requiredEvidenceKinds: evidenceKinds,
    requirements: [requirement()],
    evidence: [
      evidence("A-journey", "automated"),
      evidence("R-full", "real-model"),
      evidence("W-product", "target-device"),
      evidence("H-product", "architect"),
    ],
    accessibilityFindings: [],
    ...overrides,
  };
}

describe("Phase 38 readiness evaluation", () => {
  it("returns a deterministic ready report for exhaustive current passing evidence", () => {
    const report = buildPhase38ReadinessReport(input());

    expect(report).toEqual({
      schemaVersion: 1,
      generatedAt,
      conclusion: "ready",
      requirements: [requirement()],
      blockerIds: [],
      seriousAccessibilityFindingIds: [],
      evidenceKinds,
      limitations: [],
    });
  });

  it("aggregates dispositions, unsupported signals, and unresolved serious findings", () => {
    const report = buildPhase38ReadinessReport(
      input({
        requirements: [
          requirement({ disposition: "cutover-blocker" }),
          requirement({
            id: "RESP-01",
            evidenceIds: ["W-reflow"],
            status: "unsupported",
          }),
        ],
        requiredRequirementIds: ["INPUT-01", "RESP-01"],
        evidence: [
          evidence("A-journey", "automated"),
          evidence("R-full", "real-model"),
          evidence("W-product", "target-device"),
          evidence("W-reflow", "target-device", "unsupported"),
          evidence("H-product", "architect"),
        ],
        accessibilityFindings: [
          {
            id: "AXE-01",
            impact: "serious",
            resolved: false,
            evidenceIds: ["A-journey"],
          },
        ],
      }),
    );

    expect(report.conclusion).toBe("blocked");
    expect(report.blockerIds).toEqual(["INPUT-01", "RESP-01"]);
    expect(report.seriousAccessibilityFindingIds).toEqual(["AXE-01"]);
    expect(report.limitations).toEqual(["Signal unavailable on this environment."]);
  });

  it.each([
    ["missing requirement", { requirements: [] }],
    ["missing evidence", { requirements: [requirement({ evidenceIds: ["missing"] })] }],
    [
      "contradictory evidence",
      {
        requirements: [requirement({ status: "passed" })],
        evidence: [
          evidence("A-journey", "automated", "failed"),
          evidence("R-full", "real-model"),
          evidence("W-product", "target-device"),
          evidence("H-product", "architect"),
        ],
      },
    ],
    [
      "stale evidence",
      {
        evidence: [
          {
            ...evidence("A-journey", "automated"),
            capturedAt: "2026-08-04T11:00:00.000Z",
          },
          evidence("R-full", "real-model"),
          evidence("W-product", "target-device"),
          evidence("H-product", "architect"),
        ],
      },
    ],
  ])("fails closed on %s", (_label, overrides) => {
    expect(() =>
      buildPhase38ReadinessReport(
        input(overrides as Partial<BuildPhase38ReadinessReportInput>),
      ),
    ).toThrow();
  });

  it("requires architect evidence for accepted differences", () => {
    expect(() =>
      buildPhase38ReadinessReport(
        input({ requirements: [requirement({ disposition: "accepted-difference" })] }),
      ),
    ).toThrow(/architect evidence/);
  });

  it.each([
    [{ filename: "private.png" }],
    [{ outcome: "blob:secret" }],
    [{ limitation: "C:\\Users\\person\\photo.jpg" }],
  ])("rejects user-content-shaped metadata", (value) => {
    expect(() => assertPrivacySafeReadinessValue(value)).toThrow(
      /forbidden|user-content/,
    );
  });
});
