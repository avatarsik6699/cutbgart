import type { DocumentId, MagicCutoutMode, MagicDraftId, Revision } from "@/v2/domain";

export type MagicPoint = Readonly<{ x: number; y: number }>;

export type MagicStroke = Readonly<{
  id: string;
  mode: MagicCutoutMode;
  points: readonly MagicPoint[];
  radius: number;
}>;

export type MagicDraftSnapshot = Readonly<{
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

export type MagicStrokeStart = Readonly<{
  id: string;
  mode: MagicCutoutMode;
  point: MagicPoint;
  radius: number;
}>;
