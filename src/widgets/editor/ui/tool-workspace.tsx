import { m } from "@/paraglide/messages";
import type { DocumentStatus } from "@/editor/domain";
import type {
  BackgroundRuntimeSnapshot,
  EnhancementRuntimeSnapshot,
  MagicRuntimeProgress,
} from "@/editor/runtime";
import { Typography } from "@/shared/ui";

import { BackgroundWorkspace, type BackgroundInteraction } from "./background";
import {
  type CutoutPresentationMode,
  type EditorToolWorkspaceProjection,
} from "./editor-tools";
import { EnhancementWorkspace, type EnhancementInteraction } from "./enhancements";
import { ImageStage } from "./image-stage";
import { MagicCutoutWorkspace, type MagicCutoutInteraction } from "./magic-cutout";
import { ManualCutoutWorkspace, type ManualCutoutInteraction } from "./manual-cutout";
import { ToolPanelSlot } from "./editor-tools";

export type ToolWorkspaceProps = Readonly<{
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

export function ToolWorkspace(props: ToolWorkspaceProps) {
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
        <ImageStage
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
            {m.editorMagicReady()}
          </Typography>
        </ToolPanelSlot>
      </div>
    </>
  );
}
