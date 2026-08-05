import type {
  ArtifactId,
  DocumentId,
  MagicCandidateId,
  MagicCandidateSummary,
  MagicDraftId,
  MagicPredictionCorrelation,
} from "@/v2/domain";

import type { MagicStroke } from "./magic-cutout.types";
import { rankAndFuseMagicCandidates } from "./magic-candidate-policy";
import type { TransferableMagicCandidate } from "./magic-worker-protocol";

export type MagicCandidate = Readonly<{
  candidateId: MagicCandidateId;
  correlation: MagicPredictionCorrelation;
  data: Uint8ClampedArray;
  height: number;
  score: number;
  source: ArtifactId;
  width: number;
}>;

function transferableCandidateData(data: Uint8ClampedArray): ArrayBuffer {
  return data.buffer instanceof ArrayBuffer ? data.buffer : data.slice().buffer;
}

export class MagicCandidateRepository {
  readonly #candidates = new Map<MagicCandidateId, MagicCandidate>();
  readonly #nextId: () => MagicCandidateId;
  readonly #previewByDraft = new Map<MagicDraftId, MagicCandidateId>();

  constructor(nextId: () => MagicCandidateId) {
    this.#nextId = nextId;
  }

  replace(options: {
    base: Uint8ClampedArray | null;
    correlation: MagicPredictionCorrelation;
    raw: readonly TransferableMagicCandidate[];
    source: ArtifactId;
    strokes: readonly MagicStroke[];
  }): readonly MagicCandidateSummary[] {
    const ranked = rankAndFuseMagicCandidates({
      base: options.base,
      candidates: options.raw,
      strokes: options.strokes,
    });
    return this.replaceRanked({
      correlation: options.correlation,
      ranked: ranked.map((candidate) => ({
        ...candidate,
        data: transferableCandidateData(candidate.data),
      })),
      source: options.source,
    });
  }

  replaceRanked(options: {
    correlation: MagicPredictionCorrelation;
    ranked: readonly TransferableMagicCandidate[];
    source: ArtifactId;
  }): readonly MagicCandidateSummary[] {
    this.releaseDraft(options.correlation.draftId);
    return options.ranked.map((candidate) => {
      const candidateId = this.#nextId();
      const stored: MagicCandidate = {
        ...candidate,
        candidateId,
        correlation: { ...options.correlation },
        data: new Uint8ClampedArray(candidate.data).slice(),
        source: options.source,
      };
      this.#candidates.set(candidateId, stored);
      return { candidateId, score: stored.score };
    });
  }

  get(candidateId: MagicCandidateId): MagicCandidate | null {
    const candidate = this.#candidates.get(candidateId);
    if (candidate === undefined) return null;
    return {
      ...candidate,
      correlation: { ...candidate.correlation },
      data: candidate.data.slice(),
    };
  }

  selectPreview(draftId: MagicDraftId, candidateId: MagicCandidateId): boolean {
    const candidate = this.#candidates.get(candidateId);
    if (candidate === undefined || candidate.correlation.draftId !== draftId)
      return false;
    this.#previewByDraft.set(draftId, candidateId);
    return true;
  }

  preview(candidateId: MagicCandidateId): MagicCandidate | null {
    const candidate = this.#candidates.get(candidateId);
    if (
      candidate === undefined ||
      this.#previewByDraft.get(candidate.correlation.draftId) !== candidateId
    ) {
      return null;
    }
    return this.get(candidateId);
  }

  releaseDraft(draftId: MagicDraftId): number {
    this.#previewByDraft.delete(draftId);
    let released = 0;
    for (const [candidateId, candidate] of this.#candidates) {
      if (candidate.correlation.draftId !== draftId) continue;
      this.#candidates.delete(candidateId);
      released += 1;
    }
    return released;
  }

  releaseDocument(documentId: DocumentId): number {
    let released = 0;
    for (const [candidateId, candidate] of this.#candidates) {
      if (candidate.correlation.documentId !== documentId) continue;
      this.#previewByDraft.delete(candidate.correlation.draftId);
      this.#candidates.delete(candidateId);
      released += 1;
    }
    return released;
  }

  dispose(): void {
    this.#candidates.clear();
    this.#previewByDraft.clear();
  }

  get size(): number {
    return this.#candidates.size;
  }

  get previewLeases(): number {
    return this.#previewByDraft.size;
  }
}
