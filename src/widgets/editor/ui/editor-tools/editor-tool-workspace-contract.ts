import type {
  BackgroundTypes,
  DocumentId,
  EnhancementTypes,
  MagicCutoutTypes,
  DocumentHistoryTypes,
} from "@/editor/domain";

export type EditorToolId = "cutout" | "enhance" | "background";
export type CutoutPresentationMode = "magic" | "manual";

export type EditorToolWorkspaceProjection = Readonly<{
  locale: "ru" | "en";
  documentId: DocumentId;
  revision: number;
  activeTool: EditorToolId;
  cutoutMode: CutoutPresentationMode;
  canUndoDraft: boolean;
  canRedoDraft: boolean;
  canUndoDocument: boolean;
  canRedoDocument: boolean;
  dirtyDraft: boolean;
  busy: boolean;
  sourcePreviewUrl: string;
  committedResultUrl: string;
  width: number;
  height: number;
  manualDraft: DocumentHistoryTypes.ManualDraft | null;
  magicDraft: MagicCutoutTypes.Draft | null;
  backgroundDraft: BackgroundTypes.Draft | null;
  enhancementDraft: EnhancementTypes.Draft | null;
}>;

export type EditorToolWorkspaceIntent =
  | Readonly<{ type: "choose-tool"; tool: EditorToolId }>
  | Readonly<{ type: "choose-cutout-mode"; mode: CutoutPresentationMode }>
  | Readonly<{
      type: "undo-draft" | "redo-draft" | "undo-document" | "redo-document";
    }>
  | Readonly<{
      type:
        | "apply-active-tool"
        | "cancel-active-tool"
        | "retry-active-tool"
        | "download-committed"
        | "leave-workspace";
    }>
  | Readonly<{ type: "choose-background"; fill: BackgroundTypes.FillDescriptor }>
  | Readonly<{
      type: "choose-enhancements";
      operationIds: readonly EnhancementTypes.OperationId[];
    }>;

export type EditorToolWorkspacePresentationProps = Readonly<{
  projection: EditorToolWorkspaceProjection;
  onIntent(intent: EditorToolWorkspaceIntent): void;
}>;
