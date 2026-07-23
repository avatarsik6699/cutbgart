/** @deprecated Phase-17 compatibility UI; production uses `GuidedBrushCanvas`. */
export { ObjectSelectionCanvas } from "./ui/ObjectSelectionCanvas";
/** @deprecated Phase-17 compatibility UI; production uses `GuidedBrushControls`. */
export { ObjectSelectionControls } from "./ui/ObjectSelectionControls";
export { GuidedBrushCanvas } from "./ui/GuidedBrushCanvas";
export { GuidedBrushControls } from "./ui/GuidedBrushControls";
export {
  useGuidedBrushSelection,
  useObjectSelection,
} from "./model/use-object-selection";
export { fuseGuidedBrushCandidate, fuseGuidedMattes } from "./model/guided-fusion";
export {
  createGuidedBrushConstraints,
  createRefinementConstraints,
} from "./model/refinement-constraints";
export {
  MAX_GUIDED_BRUSH_PROMPTS,
  consolidateGuidedBrushStrokes,
} from "./model/guided-brush-sampling";
export { createGuidedBrushViewSession } from "./model/guided-brush-session";
export {
  MATERIAL_DIFFERENCE_RATIO,
  rankGuidedBrushCandidates,
} from "./model/candidate-ranking";
export { GUIDED_MODEL } from "./model/types";
export type {
  GuidedBox,
  GuidedBrushCandidate,
  GuidedBrushMode,
  GuidedBrushSession,
  GuidedBrushStatus,
  GuidedBrushStroke,
  GuidedBrushViewSession,
  GuidedMaskCandidate,
  GuidedPoint,
  GuidedModelProfile,
  ObjectMaskLayer,
  ObjectSelectionStatus,
  PromptPointLabel,
  PromptSession,
  SemanticStroke,
  SemanticStrokeMode,
} from "./model/types";
