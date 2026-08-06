import type { ReactNode } from "react";

import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";
import { EditorToolbar, createEditorToolRegistry } from "../shared";

import type { EditorToolWorkspacePresentationProps } from "./editor-tool-workspace-contract";

type Props = EditorToolWorkspacePresentationProps &
  Readonly<{
    children: ReactNode;
    DownloadSlot?: ReactNode;
    GuardSlot?: ReactNode;
    StatusSlot?: ReactNode;
    WorkspaceActionsSlot?: ReactNode;
  }>;

export function EditorToolWorkspaceView(props: Props) {
  const projection = props.projection;

  return (
    <div
      className="tool-workspace-grid"
      data-testid="editor-tool-workspace"
      data-document-id={projection.documentId}
      data-document-revision={projection.revision}
      data-active-tool={projection.activeTool}
    >
      <div className="min-w-0 overflow-hidden [grid-area:toolbar]">
        <EditorToolbar
          tools={createEditorToolRegistry()}
          activeTool={projection.activeTool}
          onToolChange={(tool) => props.onIntent({ type: "choose-tool", tool })}
          canUndo={
            projection.canUndoDraft ||
            (!projection.dirtyDraft && projection.canUndoDocument)
          }
          canRedo={
            projection.canRedoDraft ||
            (!projection.dirtyDraft && projection.canRedoDocument)
          }
          undoLabel={projection.canUndoDraft ? m.editorV2DraftUndo() : null}
          redoLabel={projection.canRedoDraft ? m.editorV2DraftRedo() : null}
          onUndo={() =>
            props.onIntent({
              type: projection.canUndoDraft ? "undo-draft" : "undo-document",
            })
          }
          onRedo={() =>
            props.onIntent({
              type: projection.canRedoDraft ? "redo-draft" : "redo-document",
            })
          }
          StatusSlot={props.StatusSlot}
          WorkspaceActionsSlot={props.WorkspaceActionsSlot}
          DownloadSlot={props.DownloadSlot}
          onBack={() => props.onIntent({ type: "leave-workspace" })}
        />
      </div>
      {props.GuardSlot ? (
        <div className="[grid-area:guard]">{props.GuardSlot}</div>
      ) : null}
      <Typography variant="caption" as="p" className="sr-only">
        {m.editorV2Revision({ revision: String(projection.revision) })}
      </Typography>
      {props.children}
    </div>
  );
}
