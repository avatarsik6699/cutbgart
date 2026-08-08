import type { DocumentId, DocumentHistoryTypes, ManualDraftId } from "@/editor/domain";

export declare namespace ManualCutoutRuntimeTypes {
  type Point = { x: number; y: number };
  type Box = { minX: number; minY: number; maxX: number; maxY: number };

  type Patch = {
    box: Box;
    before: Uint8ClampedArray;
    after: Uint8ClampedArray;
  };

  type Brush = {
    mode: DocumentHistoryTypes.ManualMode;
    radius: number;
    hardness: number;
  };

  type Draft = {
    draftId: ManualDraftId;
    documentId: DocumentId;
    width: number;
    height: number;
  };
}
