import type { ReactNode } from "react";

import { m } from "@/paraglide/messages";
import { Typography } from "@/v2/shared/ui";
import { EditorToolbar, createEditorToolRegistry } from "@/widgets/tool-workspace";

import type { EditorToolWorkspacePresentationProps } from "./editor-tool-workspace-contract";

type Props = EditorToolWorkspacePresentationProps &
  Readonly<{
    children: ReactNode;
    downloadSlot?: ReactNode;
    guardSlot?: ReactNode;
    statusSlot?: ReactNode;
    workspaceActionsSlot?: ReactNode;
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
          canUndo={!projection.dirtyDraft && projection.canUndoDocument}
          canRedo={!projection.dirtyDraft && projection.canRedoDocument}
          onUndo={() => props.onIntent({ type: "undo-document" })}
          onRedo={() => props.onIntent({ type: "redo-document" })}
          statusSlot={props.statusSlot}
          workspaceActionsSlot={props.workspaceActionsSlot}
          downloadSlot={props.downloadSlot}
          onBack={() => props.onIntent({ type: "leave-workspace" })}
        />
      </div>
      {props.guardSlot ? (
        <div className="[grid-area:guard]">{props.guardSlot}</div>
      ) : null}
      <Typography variant="caption" as="p" className="sr-only">
        {m.editorV2Revision({ revision: String(projection.revision) })}
      </Typography>
      {props.children}
    </div>
  );
}
