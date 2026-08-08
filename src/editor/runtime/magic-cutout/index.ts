export {
  MAGIC_STROKE_LIMIT,
  MAGIC_STROKE_POINT_LIMIT,
  MagicDraftEngine,
} from "./magic-draft-engine";
export { MagicDraftRepository } from "./magic-draft-repository";
export { MagicCutoutController } from "./magic-cutout-controller";
export { MagicCandidateRepository } from "./magic-candidate-repository";
export type { MagicCandidate } from "./magic-candidate-repository";
export {
  createMagicConstraints,
  rankAndFuseMagicCandidates,
} from "./magic-candidate-policy";
export type { MagicConstraintMaps, RankedMagicCandidate } from "./magic-candidate-policy";
export { createMagicModelPrompts, MAGIC_MODEL_PROMPT_LIMIT } from "./magic-prompt-policy";
export { MagicWorkerClient } from "./magic-worker-client";
export type {
  MagicPredictionProgress,
  MagicWorkerPredictionInput,
} from "./magic-worker-client";
export { MagicPredictionService } from "./magic-prediction-service";
export type {
  MagicPredictionArtifacts,
  MagicPredictionClient,
  MagicRuntimeProgress,
} from "./magic-prediction-service";
export { createNativeMagicWorkerFactory } from "./magic-worker-factory";
export type { MagicWorker, MagicWorkerFactory } from "./magic-worker-factory";
export {
  MAGIC_WORKER_PROTOCOL_VERSION,
  sameMagicCorrelation,
} from "./magic-worker-protocol";
export { WorkerMagicCutoutCommitter } from "./worker-magic-cutout-committer";
export type {
  MagicPredictionStage,
  MagicWorkerCommand,
  MagicWorkerEvent,
  TransferableMagicCandidate,
  TransferableMagicSource,
} from "./magic-worker-protocol";
