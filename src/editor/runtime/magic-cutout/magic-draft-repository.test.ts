import { describe, expect, it } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createMagicCandidateId,
  createMagicDraftId,
  createRunId,
} from "@/editor/domain";

import { MagicCandidateRepository } from "./magic-candidate-repository";
import { MagicDraftRepository } from "./magic-draft-repository";

describe("MagicDraftRepository", () => {
  it("owns drafts by document and releases each lifecycle deterministically", () => {
    const repository = new MagicDraftRepository();
    const documentId = createDocumentId("document-1");
    const firstId = createMagicDraftId("draft-1");
    const secondId = createMagicDraftId("draft-2");
    repository.create({ documentId, draftId: firstId, width: 10, height: 10 });
    repository.create({ documentId, draftId: secondId, width: 10, height: 10 });
    expect(repository.size).toBe(2);
    expect(() =>
      repository.create({ documentId, draftId: firstId, width: 10, height: 10 }),
    ).toThrow("Magic draft already exists");

    expect(repository.release(firstId)).toBe(true);
    expect(repository.release(firstId)).toBe(false);
    expect(repository.releaseDocument(documentId)).toBe(1);
    expect(repository.size).toBe(0);
    repository.dispose();
  });
});

describe("Magic runtime ownership churn", () => {
  it("releases every draft, candidate, and preview lease after deterministic churn", () => {
    const drafts = new MagicDraftRepository();
    let nextCandidate = 0;
    let seed = 0x35c0ffee;
    const random = (): number => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const candidates = new MagicCandidateRepository(() =>
      createMagicCandidateId(`candidate-${++nextCandidate}`),
    );
    for (let cycle = 0; cycle < 100; cycle += 1) {
      const documentId = createDocumentId(`document-${cycle}`);
      const draftId = createMagicDraftId(`draft-${cycle}`);
      const draft = drafts.create({ documentId, draftId, width: 2, height: 2 });
      const strokeCount = 1 + Math.floor(random() * 5);
      for (let stroke = 0; stroke < strokeCount; stroke += 1) {
        draft.beginStroke({
          id: `stroke-${cycle}-${stroke}`,
          mode: random() < 0.5 ? "keep" : "remove",
          radius: 1,
          point: { x: Math.floor(random() * 2), y: Math.floor(random() * 2) },
        });
        draft.commitStroke();
      }
      if (random() < 0.5) {
        draft.undo();
        if (random() < 0.5) draft.redo();
      }
      const summaries = candidates.replace({
        base: null,
        correlation: {
          documentId,
          draftId,
          runId: createRunId(`run-${cycle}`),
          expectedRevision: cycle,
          draftRevision: draft.snapshot().revision,
        },
        raw: [
          {
            data: new Uint8ClampedArray([0, 255, 0, 255]).buffer,
            width: 2,
            height: 2,
            score: 0.5,
          },
        ],
        source: createArtifactId(`source-${cycle}`),
        strokes: draft.predictionStrokes(),
      });
      candidates.selectPreview(draftId, summaries[0]!.candidateId);
      expect(candidates.releaseDocument(documentId)).toBe(1);
      expect(drafts.releaseDocument(documentId)).toBe(1);
    }

    expect(drafts.size).toBe(0);
    expect(candidates.size).toBe(0);
    expect(candidates.previewLeases).toBe(0);
  });
});
