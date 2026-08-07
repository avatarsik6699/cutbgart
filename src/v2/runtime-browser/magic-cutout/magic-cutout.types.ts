import type { DocumentId, MagicCutoutTypes, MagicDraftId, Revision } from "@/v2/domain";

export declare namespace MagicCutoutRuntimeTypes {
  type Point = Readonly<{ x: number; y: number }>;

  type Stroke = Readonly<{
    id: string;
    mode: MagicCutoutTypes.Mode;
    points: readonly Point[];
    radius: number;
  }>;

  type DraftSnapshot = Readonly<{
    documentId: DocumentId;
    draftId: MagicDraftId;
    revision: Revision;
    dirty: boolean;
    strokeCount: number;
    redoCount: number;
    canUndo: boolean;
    canRedo: boolean;
    gestureActive: boolean;
    disposed: boolean;
  }>;

  type StrokeStart = Readonly<{
    id: string;
    mode: MagicCutoutTypes.Mode;
    point: Point;
    radius: number;
  }>;
}
