import { useEffect } from "react";

import { selectDocumentStatus } from "@/editor/application";
import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

import {
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

export function ActiveTool() {
  const model = useActiveDocumentModel();
  const status = useActiveDocumentActorSelector(selectDocumentStatus);
  const draftKind = useActiveDocumentActorSelector(
    (snapshot) => snapshot.context.document.activeDraft?.kind ?? null,
  );
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
  const snapshot = useEditorSessionValue((session) => {
    const current = session.getSnapshot();
    return current.kind === "document" ? current : null;
  });
  if (snapshot === null || snapshot.previewUrl === null || snapshot.resultUrl === null)
    return null;

  return (
    <>
      <div className="[grid-area:surface]">
        <ImageStage
          fileName={snapshot.fileName}
          grid="fine"
          height={snapshot.height}
          onFiles={(files) => void model.editor.session.importImages(files)}
          previewUrl={snapshot.previewUrl}
          resultUrl={snapshot.resultUrl}
          status={status}
          width={snapshot.width}
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
