import type { ProcessingProgress, ProcessingStage } from "@/v2/domain";

import type { ProcessingWorkerEvent } from "./worker-protocol";

const STAGE_ORDER = [
  "queued",
  "model-loading",
  "automatic-remove",
  "post-process",
  "decode",
  "composite",
  "encode-png",
] as const satisfies readonly ProcessingStage[];

export type WorkerProgressCursor = {
  lastFraction: number | null;
  lastStageIndex: number;
};

export function acceptWorkerProgress(
  cursor: WorkerProgressCursor,
  event: Extract<ProcessingWorkerEvent, { type: "PROGRESS" }>,
): ProcessingProgress | null {
  const stageIndex = STAGE_ORDER.indexOf(event.stage);
  const regressiveStage = stageIndex < cursor.lastStageIndex;
  const regressiveFraction =
    stageIndex === cursor.lastStageIndex &&
    event.fraction !== null &&
    cursor.lastFraction !== null &&
    event.fraction < cursor.lastFraction;
  const invalidFraction =
    event.fraction !== null &&
    (!Number.isFinite(event.fraction) || event.fraction < 0 || event.fraction > 1);
  if (stageIndex < 0 || regressiveStage || regressiveFraction || invalidFraction)
    return null;
  cursor.lastStageIndex = stageIndex;
  cursor.lastFraction = event.fraction;
  return { ...event.correlation, stage: event.stage, fraction: event.fraction };
}
