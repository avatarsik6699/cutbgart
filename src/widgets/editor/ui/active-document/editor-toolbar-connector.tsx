import {
  useActiveDocumentModel,
  useActiveDocumentViewSelector,
  useEditorViewSelector,
  type ActiveDocumentViewSnapshot,
  type EditorViewSnapshot,
} from "../../model";
import { createEditorToolRegistry, EditorToolbar } from "../editor-tools";
import { BatchActionsConnector } from "../connectors/batch-connectors";
import { ToolbarDownloadControl } from "./toolbar-download-control";
import { ToolbarRuntimeStatus } from "./toolbar-runtime-status";
import { useToolbarHistory } from "./use-toolbar-history";

const tools = createEditorToolRegistry();
const selectActiveTool = (snapshot: ActiveDocumentViewSnapshot) => snapshot.activeTool;
const selectBatchMode = (snapshot: EditorViewSnapshot) => snapshot.batchMode;

export function EditorToolbarConnector() {
  const document = useActiveDocumentModel();
  const history = useToolbarHistory();
  const activeTool = useActiveDocumentViewSelector(selectActiveTool);
  const batchMode = useEditorViewSelector(selectBatchMode);
  return (
    <EditorToolbar
      tools={tools}
      activeTool={activeTool}
      onToolChange={(tool) => document.requestTool(tool)}
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      undoLabel={history.undoLabel}
      redoLabel={history.redoLabel}
      onUndo={history.undo}
      onRedo={history.redo}
      StatusSlot={<ToolbarRuntimeStatus />}
      WorkspaceActionsSlot={
        batchMode ? <BatchActionsConnector disabled={false} /> : undefined
      }
      DownloadSlot={<ToolbarDownloadControl />}
      onBack={() => document.requestLeave()}
    />
  );
}
