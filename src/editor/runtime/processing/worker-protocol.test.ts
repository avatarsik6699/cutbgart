import { describe, expect, it } from "vitest";

import { createDocumentId, createRunId } from "@/editor/domain";

import { sameCorrelation } from "./worker-protocol";

describe("processing worker protocol", () => {
  it("correlates document, run, and expected revision together", () => {
    const correlation = {
      documentId: createDocumentId("document-1"),
      runId: createRunId("run-1"),
      expectedRevision: 2,
    };

    expect(sameCorrelation(correlation, { ...correlation })).toBe(true);
    expect(sameCorrelation(correlation, { ...correlation, expectedRevision: 3 })).toBe(
      false,
    );
    expect(
      sameCorrelation(correlation, { ...correlation, runId: createRunId("run-2") }),
    ).toBe(false);
  });
});
