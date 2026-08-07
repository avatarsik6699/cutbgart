import { ProcessingGatewayError, type MagicCutoutPredictor } from "@/editor/application";
import type { ArtifactId, DocumentId, MagicCutoutTypes, Revision } from "@/editor/domain";

import { MagicCandidateRepository } from "./magic-candidate-repository";
import { MagicDraftRepository } from "./magic-draft-repository";
import type {
  MagicPredictionProgress,
  MagicWorkerPredictionInput,
} from "./magic-worker-client";
import type { TransferableMagicCandidate } from "./magic-worker-protocol";

export type MagicPredictionArtifacts = Readonly<{
  baseMatte: Uint8ClampedArray | null;
  revision: Revision;
  source: ArtifactId;
}>;

export type MagicPredictionClient = {
  predict(
    input: MagicWorkerPredictionInput,
    signal: AbortSignal,
    publish: (progress: MagicPredictionProgress) => void,
  ): Promise<readonly TransferableMagicCandidate[]>;
};

export type MagicRuntimeProgress =
  MagicPredictionProgress | { stage: "magic-queued"; fraction: null };

function staleError(): ProcessingGatewayError {
  return new ProcessingGatewayError({
    code: "aborted",
    message: "Magic prediction became stale",
    retryable: true,
  });
}

export class MagicPredictionService implements MagicCutoutPredictor {
  readonly #artifactsFor: (documentId: DocumentId) => MagicPredictionArtifacts | null;
  readonly #candidates: MagicCandidateRepository;
  readonly #client: MagicPredictionClient;
  readonly #drafts: MagicDraftRepository;
  readonly #publish: (
    correlation: MagicCutoutTypes.PredictionCorrelation,
    progress: MagicRuntimeProgress | null,
  ) => void;

  constructor(options: {
    artifactsFor(documentId: DocumentId): MagicPredictionArtifacts | null;
    candidates: MagicCandidateRepository;
    client: MagicPredictionClient;
    drafts: MagicDraftRepository;
    publish?: (
      correlation: MagicCutoutTypes.PredictionCorrelation,
      progress: MagicRuntimeProgress | null,
    ) => void;
  }) {
    this.#artifactsFor = (documentId) => options.artifactsFor(documentId);
    this.#candidates = options.candidates;
    this.#client = options.client;
    this.#drafts = options.drafts;
    this.#publish = options.publish ?? (() => undefined);
  }

  async predict(
    input: MagicCutoutTypes.PredictionCorrelation,
    signal: AbortSignal,
  ): Promise<readonly MagicCutoutTypes.CandidateSummary[]> {
    const draft = this.#drafts.get(input.draftId);
    const artifacts = this.#artifactsFor(input.documentId);
    if (
      draft === null ||
      draft.documentId !== input.documentId ||
      draft.snapshot().revision !== input.draftRevision ||
      artifacts === null ||
      artifacts.revision !== input.expectedRevision
    ) {
      throw staleError();
    }
    const strokes = draft.predictionStrokes();
    this.#publish(input, { stage: "magic-queued", fraction: null });
    try {
      const raw = await this.#client.predict(
        { ...input, base: artifacts.baseMatte, source: artifacts.source, strokes },
        signal,
        (progress) => this.#publish(input, progress),
      );
      const current = this.#drafts.get(input.draftId);
      const currentArtifacts = this.#artifactsFor(input.documentId);
      if (
        signal.aborted ||
        current !== draft ||
        current.snapshot().revision !== input.draftRevision ||
        currentArtifacts === null ||
        currentArtifacts.revision !== input.expectedRevision ||
        currentArtifacts.source !== artifacts.source
      ) {
        throw staleError();
      }
      return this.#candidates.replaceRanked({
        correlation: input,
        ranked: raw,
        source: artifacts.source,
      });
    } finally {
      this.#publish(input, null);
    }
  }
}
