import { describe, expect, it } from "vitest";

import { createDocumentId, createRunId } from "@/editor/domain";

import { acceptWorkerProgress } from "./worker-progress-policy";

const correlation = {
  documentId: createDocumentId("document-1"),
  runId: createRunId("run-1"),
  expectedRevision: 0,
};

describe("worker progress policy", () => {
  it("accepts monotonic progress and rejects regressive updates", () => {
    const cursor = { lastFraction: null, lastStageIndex: -1 };
    expect(
      acceptWorkerProgress(cursor, {
        protocol: 1,
        type: "PROGRESS",
        correlation,
        stage: "automatic-remove",
        fraction: 0.5,
        timing: null,
      }),
    ).toMatchObject({ stage: "automatic-remove", fraction: 0.5 });
    expect(
      acceptWorkerProgress(cursor, {
        protocol: 1,
        type: "PROGRESS",
        correlation,
        stage: "automatic-remove",
        fraction: 0.25,
        timing: null,
      }),
    ).toBeNull();
  });
});
