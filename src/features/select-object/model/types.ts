import type {
  AlphaMatte,
  PixelRect,
  SourceImage,
} from "../../../entities/processed-image";

export type GuidedBrushMode = "keep" | "remove";

export type GuidedBrushStatus =
  | "idle"
  | "loading-model"
  | "encoding-image"
  | "ready"
  | "dirty"
  | "predicting"
  | "preview"
  | "error";

export interface GuidedBrushStroke {
  id: string;
  mode: GuidedBrushMode;
  points: readonly { x: number; y: number }[];
  /** Source-image pixels. Overlay opacity is presentational only. */
  radius: number;
}

export interface GuidedBrushCandidate {
  id: string;
  matte: AlphaMatte;
  /** Any finite raw `iou_scores` value; never a public accuracy percentage. */
  modelRankScore: number | null;
  /** Pre-hard-constraint agreement with visible keep/remove markings. */
  intentScore: number;
  /** Difference from the leading candidate inside `editRegion` only. */
  differenceRatio: number;
  /** Selected-pixel share inside `editRegion`; used only for honest contour descriptions. */
  foregroundRatio: number;
}

export interface GuidedBrushSession {
  source: SourceImage;
  baseMatte: AlphaMatte | null;
  strokes: readonly GuidedBrushStroke[];
  brushRadius: number;
  status: GuidedBrushStatus;
  revision: number;
  computedRevision: number | null;
  editRegion: PixelRect | null;
  candidates: readonly GuidedBrushCandidate[];
  selectedCandidateId: string | null;
  /** Bounded gesture deltas; no full-resolution matte snapshots. */
  history: readonly GuidedBrushStroke[];
  redo: readonly GuidedBrushStroke[];
}

export type GuidedBrushCandidateSummary = Omit<GuidedBrushCandidate, "matte">;

/**
 * Render-safe projection. Full-resolution candidate mattes stay behind the
 * hook's stable ref/state boundary and never cross a changing React prop.
 */
export interface GuidedBrushViewSession extends Omit<
  GuidedBrushSession,
  "baseMatte" | "candidates"
> {
  hasBaseMatte: boolean;
  candidates: readonly GuidedBrushCandidateSummary[];
}

export type PromptPointLabel = 0 | 1;

export interface GuidedPoint {
  id: string;
  x: number;
  y: number;
  label: PromptPointLabel;
}

export interface GuidedBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export type SemanticStrokeMode = "keep" | "remove";

export interface SemanticStroke {
  id: string;
  mode: SemanticStrokeMode;
  points: readonly { x: number; y: number }[];
  radius: number;
}

export interface GuidedMaskCandidate {
  id: string;
  matte: AlphaMatte;
  /** @internal Raw model ranking signal; never display as confidence. */
  score: number | null;
  differenceRatio: number;
}

export interface ObjectMaskLayer {
  id: string;
  points: readonly GuidedPoint[];
  targetBox: GuidedBox | null;
  strokes: readonly SemanticStroke[];
  candidates: readonly GuidedMaskCandidate[];
  selectedCandidateId: string | null;
  acceptedMatte: AlphaMatte | null;
}

export type PromptHistoryEntry =
  | { type: "point-added"; layerId: string; point: GuidedPoint }
  | {
      type: "box-changed";
      layerId: string;
      before: GuidedBox | null;
      after: GuidedBox | null;
    }
  | { type: "stroke-added"; layerId: string; stroke: SemanticStroke }
  | {
      type: "candidate-selected";
      layerId: string;
      beforeId: string | null;
      afterId: string | null;
    }
  | { type: "layer-added"; layerId: string }
  | {
      type: "layer-removed";
      layerId: string;
      promptData: {
        points: readonly GuidedPoint[];
        targetBox: GuidedBox | null;
        strokes: readonly SemanticStroke[];
        selectedCandidateId: string | null;
      };
      index: number;
    }
  | { type: "layer-selected"; beforeId: string; afterId: string };

export interface PromptSession {
  source: SourceImage;
  baseMatte: AlphaMatte | null;
  layers: readonly ObjectMaskLayer[];
  activeLayerId: string;
  revision: number;
  history: readonly PromptHistoryEntry[];
  redo: readonly PromptHistoryEntry[];
}

export interface IterativeSelectionPrompt {
  revision: number;
  points: readonly GuidedPoint[];
  box: GuidedBox | null;
  previousMask: AlphaMatte | null;
}

export type ObjectSelectionStatus =
  | "idle"
  | "loading-model"
  | "encoding-image"
  | "ready-for-prompt"
  | "predicting-mask"
  | "preview"
  | "error";

export interface GuidedModelProfile {
  modelId: "Xenova/slimsam-77-uniform";
  revision: "7c8459c48dabad6291b384c97be46c451c25d6c4";
  dtype: "q8";
  approximateBytes: 13_840_000;
  supportedPaths: readonly ["wasm"];
  license: "Apache-2.0";
}

export const GUIDED_MODEL: GuidedModelProfile = {
  modelId: "Xenova/slimsam-77-uniform",
  revision: "7c8459c48dabad6291b384c97be46c451c25d6c4",
  dtype: "q8",
  approximateBytes: 13_840_000,
  supportedPaths: ["wasm"],
  license: "Apache-2.0",
};

export type SelectObjectWorkerRequest =
  | { type: "encode"; revision: number; source: SourceImage }
  | { type: "prompt"; prompt: IterativeSelectionPrompt }
  | { type: "reset"; revision: number }
  | { type: "dispose"; revision: number };

export type SelectObjectWorkerResponse =
  | {
      type: "status";
      revision: number;
      status: Exclude<ObjectSelectionStatus, "error" | "preview">;
      progress?: number;
    }
  | { type: "candidates"; revision: number; candidates: GuidedMaskCandidate[] }
  | { type: "disposed"; revision: number }
  | { type: "error"; revision: number; message: string };
