import type {
  BackgroundDraft,
  BackgroundFillDescriptor,
  DocumentId,
  EnhancementDraft,
  EnhancementOperationId,
  MagicCutoutDraft,
  ManualCutoutDraft,
} from "@/v2/domain";

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
  manualDraft: ManualCutoutDraft | null;
  magicDraft: MagicCutoutDraft | null;
  backgroundDraft: BackgroundDraft | null;
  enhancementDraft: EnhancementDraft | null;
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
  | Readonly<{ type: "choose-background"; fill: BackgroundFillDescriptor }>
  | Readonly<{
      type: "choose-enhancements";
      operationIds: readonly EnhancementOperationId[];
    }>;

export type EditorToolWorkspacePresentationProps = Readonly<{
  projection: EditorToolWorkspaceProjection;
  onIntent(intent: EditorToolWorkspaceIntent): void;
}>;
