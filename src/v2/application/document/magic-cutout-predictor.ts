import type { MagicCandidateSummary, MagicPredictionCorrelation } from "@/v2/domain";

export type MagicPredictionInput = MagicPredictionCorrelation;

export type MagicCutoutPredictor = {
  predict(
    input: MagicPredictionInput,
    signal: AbortSignal,
  ): Promise<readonly MagicCandidateSummary[]>;
};
