export type {
  BackgroundFill,
  BackgroundGradientStop,
  HexColor,
  QualityMode,
  InferencePath,
  DeviceCapabilities,
  SourceImage,
  AlphaMatte,
  ProcessedImage,
} from "./model/types";
export {
  applyBrushStroke,
  brushBoundingBox,
  extractAlphaRegion,
  interpolateStrokePoints,
  stampBrushAlphaInPlace,
  stampBrushStrokeAlphaInPlace,
  unionBoundingBox,
  writeAlphaRegion,
} from "./model/mask-correction";
export type {
  BrushMode,
  BrushStroke,
  BrushBoundingBox,
  MaskPatch,
} from "./model/mask-correction";
export { BeforeAfterSlider } from "./ui/BeforeAfterSlider";
export type { BeforeAfterSliderProps } from "./ui/BeforeAfterSlider";
