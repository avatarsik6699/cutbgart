import { useEffect } from "react";

import { selectDocumentStatus } from "@/editor/application";
import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

import {
  selectActiveFileName,
  selectActiveHeight,
  selectActivePreviewUrl,
  selectActiveResultUrl,
  selectActiveWidth,
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useActiveDocumentViewSelector,
  useEditorSessionValue,
  type ActiveDocumentViewSnapshot,
} from "../../model";
import { BackgroundConnector } from "../background";
import { EnhancementConnector } from "../enhancements";
import { ImageStage } from "../image-stage";
import { MagicCutoutConnector } from "../magic-cutout";
import { ManualCutoutConnector } from "../manual-cutout";
import { ToolPanelSlot } from "../editor-tools";

const selectActiveTool = (snapshot: ActiveDocumentViewSnapshot) => snapshot.activeTool;
const selectCutoutMode = (snapshot: ActiveDocumentViewSnapshot) => snapshot.cutoutMode;
const selectDraftKind = (snapshot: Parameters<typeof selectDocumentStatus>[0]) =>
  snapshot.context.document.activeDraft?.kind ?? null;

export function ActiveTool() {
  const model = useActiveDocumentModel();
  const status = useActiveDocumentActorSelector(selectDocumentStatus);
  const draftKind = useActiveDocumentActorSelector(selectDraftKind);
  const activeTool = useActiveDocumentViewSelector(selectActiveTool);
  const cutoutMode = useActiveDocumentViewSelector(selectCutoutMode);

  useEffect(
    function openSelectedToolFx() {
      model.ensureSelectedToolOpen();
    },
    [activeTool, cutoutMode, draftKind, model, status],
  );

  if (draftKind === "magic-cutout") return <MagicCutoutConnector />;
  if (draftKind === "manual-cutout") return <ManualCutoutConnector />;
  if (draftKind === "background") return <BackgroundConnector />;
  if (draftKind === "enhance") return <EnhancementConnector />;
  return <CommittedDocumentStage />;
}

function CommittedDocumentStage() {
  const model = useActiveDocumentModel();
  const status = useActiveDocumentActorSelector(selectDocumentStatus);
  const fileName = useEditorSessionValue(selectActiveFileName);
  const height = useEditorSessionValue(selectActiveHeight);
  const previewUrl = useEditorSessionValue(selectActivePreviewUrl);
  const resultUrl = useEditorSessionValue(selectActiveResultUrl);
  const width = useEditorSessionValue(selectActiveWidth);
  if (fileName === null || previewUrl === null || resultUrl === null) return null;

  return (
    <>
      <div className="[grid-area:surface]">
        <ImageStage
          fileName={fileName}
          grid="fine"
          height={height}
          onFiles={(files) => void model.editor.session.importImages(files)}
          previewUrl={previewUrl}
          resultUrl={resultUrl}
          status={status}
          width={width}
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
