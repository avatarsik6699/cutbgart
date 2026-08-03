import type { DocumentId, ManualCutoutMode, ManualDraftId } from "@/v2/domain";

export type ManualCutoutPoint = { x: number; y: number };
export type ManualCutoutBox = { minX: number; minY: number; maxX: number; maxY: number };

export type ManualCutoutPatch = {
  box: ManualCutoutBox;
  before: Uint8ClampedArray;
  after: Uint8ClampedArray;
};

export type ManualCutoutBrush = {
  mode: ManualCutoutMode;
  radius: number;
  hardness: number;
};

export type ManualDraftRuntime = {
  draftId: ManualDraftId;
  documentId: DocumentId;
  width: number;
  height: number;
};
