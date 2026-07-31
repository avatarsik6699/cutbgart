export { useMatteRefinement } from "./model/use-matte-refinement";
// @deprecated — not rendered in production (PHASE_31 F-19); see the JSDoc on
// MatteRefinementControls itself. Removal candidate for a future phase.
export { MatteRefinementControls } from "./ui/MatteRefinementControls";
export type {
  MatteRefinementState,
  StartMatteRefinementInput,
} from "./model/use-matte-refinement";
export {
  MATTING_MODELS,
  formatMattingModelSize,
  getMattingModel,
  recommendMattingMode,
} from "./model/model-registry";
export {
  computeMattingInputSize,
  computeRefinementCrop,
  MAX_MATTING_INPUT_PIXELS,
  MAX_MATTING_INPUT_SIDE,
} from "./model/focus-crop";
export type {
  MatteRefinementRequest,
  MatteRefinementWorkerRequest,
  MatteRefinementWorkerResponse,
  MattingInputSize,
  MattingFallback,
  MattingModelProfile,
  MattingModelVariantId,
  MattingRefinementError,
  MattingRefinementErrorCode,
  MattingRefinementMode,
  MattingRefinementResult,
  MattingRefinementStatus,
} from "./model/types";
