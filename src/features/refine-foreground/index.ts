export type {
  DirtyPixelPatch,
  ForegroundCleanupFallback,
  ForegroundCleanupPath,
  ForegroundRefinementError,
  ForegroundRefinementErrorCode,
  ForegroundRefinementRequest,
  ForegroundRefinementResult,
  ForegroundRefinementStatus,
  ForegroundRefinementWorkerRequest,
  ForegroundRefinementWorkerResponse,
} from "./model/types";
export { estimateForegroundPixels } from "./model/estimate-foreground";
export type { ForegroundPixelResult } from "./model/estimate-foreground";
export { cleanupIsolatedSoftComponents } from "./model/edge-cleanup";
export { useForegroundRefinement } from "./model/use-foreground-refinement";
export type {
  ForegroundRefinementState,
  StartForegroundRefinementInput,
} from "./model/use-foreground-refinement";
// @deprecated — not rendered in production (PHASE_31 F-19); see the JSDoc on
// ForegroundRefinementControls itself. Removal candidate for a future phase.
export { ForegroundRefinementControls } from "./ui/ForegroundRefinementControls";
export {
  FOREGROUND_QUALITY_THRESHOLDS,
  FOREGROUND_RUNTIME_THRESHOLDS,
  evaluateForegroundQualityThresholds,
} from "./model/quality-thresholds";
export type { ForegroundRefinementControlsProps } from "./ui/ForegroundRefinementControls";
