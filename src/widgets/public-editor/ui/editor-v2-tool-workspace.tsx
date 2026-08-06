import { m } from "@/paraglide/messages";
import type { DocumentStatus } from "@/v2/domain";
import {
  BackgroundWorkspace,
  EnhancementWorkspace,
  MagicCutoutWorkspace,
  ManualCutoutWorkspace,
  type BackgroundInteraction,
  type CutoutPresentationMode,
  type EditorToolWorkspaceProjection,
  type EnhancementInteraction,
  type MagicCutoutInteraction,
  type ManualCutoutInteraction,
} from "@/v2/presentation";
import type {
  BackgroundRuntimeSnapshot,
  EnhancementRuntimeSnapshot,
  MagicRuntimeProgress,
} from "@/v2/runtime-browser";
import { Typography } from "@/shared/ui";
import { ToolPanelSlot } from "@/v2/presentation/shared";

import { EditorV2Stage } from "./editor-v2-stage";

export type EditorV2ToolWorkspaceProps = Readonly<{
  backgroundInteraction: BackgroundInteraction;
  backgroundRuntime: BackgroundRuntimeSnapshot;
  enhancementInteraction: EnhancementInteraction;
  enhancementRuntime: EnhancementRuntimeSnapshot;
  fileName: string;
  foregroundUrl: string | null;
  magicInteraction: MagicCutoutInteraction;
  magicProgress: MagicRuntimeProgress | null;
  manualInteraction: ManualCutoutInteraction;
  onCutoutModeChange(mode: CutoutPresentationMode): void;
  onFiles(files: readonly File[]): void;
  projection: EditorToolWorkspaceProjection;
  status: DocumentStatus;
}>;

export function EditorV2ToolWorkspace(props: EditorV2ToolWorkspaceProps) {
  const projection = props.projection;
  if (projection.magicDraft !== null) {
    return (
      <MagicCutoutWorkspace
        draft={projection.magicDraft}
        height={projection.height}
        runtimeProgress={props.magicProgress}
        interaction={props.magicInteraction}
        currentUrl={projection.committedResultUrl}
        width={projection.width}
        onCutoutModeChange={props.onCutoutModeChange}
      />
    );
  }
  if (projection.manualDraft !== null) {
    return (
      <ManualCutoutWorkspace
        documentId={projection.documentId}
        height={projection.height}
        interaction={props.manualInteraction}
        currentUrl={projection.committedResultUrl}
        width={projection.width}
        onCutoutModeChange={props.onCutoutModeChange}
      />
    );
  }
  if (projection.backgroundDraft !== null && props.foregroundUrl !== null) {
    return (
      <BackgroundWorkspace
        draft={projection.backgroundDraft}
        foregroundUrl={props.foregroundUrl}
        height={projection.height}
        runtime={props.backgroundRuntime}
        sourceUrl={projection.sourcePreviewUrl}
        interaction={props.backgroundInteraction}
        width={projection.width}
      />
    );
  }
  if (projection.enhancementDraft !== null) {
    return (
      <EnhancementWorkspace
        draft={projection.enhancementDraft}
        height={projection.height}
        previewUrl={projection.committedResultUrl}
        runtime={props.enhancementRuntime}
        sourceUrl={projection.sourcePreviewUrl}
        interaction={props.enhancementInteraction}
        width={projection.width}
      />
    );
  }
  return (
    <>
      <div className="[grid-area:surface]">
        <EditorV2Stage
          fileName={props.fileName}
          grid="fine"
          height={projection.height}
          onFiles={props.onFiles}
          previewUrl={projection.sourcePreviewUrl}
          resultUrl={projection.committedResultUrl}
          status={props.status}
          width={projection.width}
        />
      </div>
      <div className="[grid-area:rail]">
        <ToolPanelSlot toolId="cutout" label={m.editorToolCutout()}>
          <Typography variant="body-small" as="p" className="text-muted-foreground">
            {m.editorV2MagicReady()}
          </Typography>
        </ToolPanelSlot>
      </div>
    </>
  );
}
