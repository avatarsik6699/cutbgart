import type { MagicCutoutTypes } from "@/v2/domain";

export type MagicPredictionInput = MagicCutoutTypes.PredictionCorrelation;

export type MagicCutoutPredictor = {
  predict(
    input: MagicPredictionInput,
    signal: AbortSignal,
  ): Promise<readonly MagicCutoutTypes.CandidateSummary[]>;
};
