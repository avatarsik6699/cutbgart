import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createMagicCandidateId,
  createMagicDraftId,
  createRunId,
  type MagicCutoutTypes,
} from "@/editor/domain";

import { MagicCandidateRepository } from "./magic-candidate-repository";
import { MagicDraftRepository } from "./magic-draft-repository";
import {
  MagicPredictionService,
  type MagicPredictionArtifacts,
  type MagicPredictionClient,
  type MagicRuntimeProgress,
} from "./magic-prediction-service";

const correlation = {
  documentId: createDocumentId("document-1"),
  draftId: createMagicDraftId("draft-1"),
  runId: createRunId("run-1"),
  expectedRevision: 4,
  draftRevision: 1,
} as const;

function createHarness() {
  const drafts = new MagicDraftRepository();
  const draft = drafts.create({
    documentId: correlation.documentId,
    draftId: correlation.draftId,
    width: 1,
    height: 1,
  });
  draft.beginStroke({
    id: "stroke-1",
    mode: "keep",
    radius: 1,
    point: { x: 0, y: 0 },
  });
  draft.commitStroke();
  const candidates = new MagicCandidateRepository(() =>
    createMagicCandidateId("candidate-1"),
  );
  let artifacts: MagicPredictionArtifacts | null = {
    source: createArtifactId("source-1"),
    revision: 4,
    baseMatte: null,
  };
  const predict = vi.fn(() =>
    Promise.resolve([
      {
        data: new Uint8ClampedArray([255]).buffer,
        width: 1,
        height: 1,
        score: 0.9,
      },
    ]),
  );
  const client: MagicPredictionClient = { predict };
  const published: Array<MagicRuntimeProgress | null> = [];
  const publish = vi.fn(
    (
      _correlation: MagicCutoutTypes.PredictionCorrelation,
      progress: MagicRuntimeProgress | null,
    ): void => {
      published.push(progress);
    },
  );
  const service = new MagicPredictionService({
    artifactsFor: () => artifacts,
    candidates,
    client,
    drafts,
    publish,
  });
  return {
    candidates,
    predict,
    publish,
    published,
    service,
    setArtifacts(value: MagicPredictionArtifacts | null) {
      artifacts = value;
    },
  };
}

describe("MagicPredictionService", () => {
  it("keeps binary candidates runtime-owned and returns only summaries", async () => {
    const harness = createHarness();

    await expect(
      harness.service.predict(correlation, new AbortController().signal),
    ).resolves.toEqual([
      { candidateId: createMagicCandidateId("candidate-1"), score: 0.9 },
    ]);
    expect(harness.predict).toHaveBeenCalledWith(
      expect.objectContaining({
        ...correlation,
        base: null,
        source: createArtifactId("source-1"),
      }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(harness.candidates.size).toBe(1);
    expect(harness.published).toEqual([{ stage: "magic-queued", fraction: null }, null]);
  });

  it("rejects a stale document revision before model work", async () => {
    const harness = createHarness();
    harness.setArtifacts({
      source: createArtifactId("source-1"),
      revision: 5,
      baseMatte: null,
    });

    await expect(
      harness.service.predict(correlation, new AbortController().signal),
    ).rejects.toMatchObject({ detail: { code: "aborted" } });
    expect(harness.predict).not.toHaveBeenCalled();
  });
});
