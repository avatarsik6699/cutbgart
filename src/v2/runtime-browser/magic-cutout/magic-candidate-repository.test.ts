import { describe, expect, it } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createMagicCandidateId,
  createMagicDraftId,
  createRunId,
} from "@/v2/domain";

import { MagicCandidateRepository } from "./magic-candidate-repository";

const correlation = {
  documentId: createDocumentId("document-1"),
  draftId: createMagicDraftId("draft-1"),
  runId: createRunId("run-1"),
  expectedRevision: 0,
  draftRevision: 1,
} as const;

describe("MagicCandidateRepository", () => {
  it("owns copied ranked candidates and replaces an older draft run", () => {
    let next = 0;
    const repository = new MagicCandidateRepository(() =>
      createMagicCandidateId(`candidate-${++next}`),
    );
    const data = new Uint8ClampedArray([255]);
    const first = repository.replace({
      base: null,
      correlation,
      strokes: [{ id: "keep", mode: "keep", radius: 1, points: [{ x: 0, y: 0 }] }],
      raw: [{ data: data.buffer, width: 1, height: 1, score: 0.8 }],
      source: createArtifactId("source-1"),
    });
    data[0] = 0;

    expect(repository.get(first[0]!.candidateId)?.data[0]).toBe(255);
    expect(repository.selectPreview(correlation.draftId, first[0]!.candidateId)).toBe(
      true,
    );
    expect(repository.preview(first[0]!.candidateId)?.candidateId).toBe(
      first[0]!.candidateId,
    );
    expect(repository.previewLeases).toBe(1);
    repository.replace({
      base: null,
      correlation: { ...correlation, runId: createRunId("run-2") },
      strokes: [{ id: "remove", mode: "remove", radius: 1, points: [{ x: 0, y: 0 }] }],
      raw: [
        { data: new Uint8ClampedArray([255]).buffer, width: 1, height: 1, score: 0.5 },
      ],
      source: createArtifactId("source-1"),
    });

    expect(repository.get(first[0]!.candidateId)).toBeNull();
    expect(repository.size).toBe(1);
    expect(repository.previewLeases).toBe(0);
  });

  it("releases document ownership deterministically", () => {
    const repository = new MagicCandidateRepository(() =>
      createMagicCandidateId("candidate-1"),
    );
    repository.replace({
      base: null,
      correlation,
      strokes: [{ id: "keep", mode: "keep", radius: 1, points: [{ x: 0, y: 0 }] }],
      raw: [{ data: new Uint8ClampedArray([255]).buffer, width: 1, height: 1, score: 1 }],
      source: createArtifactId("source-1"),
    });

    expect(repository.releaseDocument(correlation.documentId)).toBe(1);
    expect(repository.size).toBe(0);
    expect(repository.previewLeases).toBe(0);
  });
});
