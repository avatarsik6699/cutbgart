import { selectDocumentRevision, selectDocumentState } from "@/editor/application";
import type { DocumentMachineTypes } from "@/editor/application";
import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

import {
  ActiveDocumentProvider,
  useActiveDocumentActorSelector,
  useActiveDocumentViewSelector,
  type ActiveDocumentViewSnapshot,
} from "../../model";
import { ActiveTool } from "./active-tool";
import { DocumentError } from "./document-error";
import { DocumentHistoryShortcuts } from "./document-history-shortcuts";
import { EditorToolbarConnector } from "./editor-toolbar-connector";
import { FinishingDraftShortcuts } from "./finishing-draft-shortcuts";
import { NavigationGuard } from "./navigation-guard";

const selectActiveTool = (snapshot: ActiveDocumentViewSnapshot) => snapshot.activeTool;

export function ActiveDocument(props: { actor: DocumentMachineTypes.ActorRef }) {
  return (
    <ActiveDocumentProvider actor={props.actor}>
      <ActiveDocumentWorkspace />
    </ActiveDocumentProvider>
  );
}

function ActiveDocumentWorkspace() {
  const documentId = useActiveDocumentActorSelector(
    (snapshot) => selectDocumentState(snapshot).documentId,
  );
  const revision = useActiveDocumentActorSelector(selectDocumentRevision);
  const activeTool = useActiveDocumentViewSelector(selectActiveTool);

  return (
    <div
      className="tool-workspace-grid"
      data-testid="editor-tool-workspace"
      data-document-id={documentId}
      data-document-revision={revision}
      data-active-tool={activeTool}
    >
      <div className="min-w-0 overflow-hidden [grid-area:toolbar]">
        <EditorToolbarConnector />
      </div>
      <NavigationGuard />
      <Typography variant="caption" as="p" className="sr-only">
        {m.editorRevision({ revision: String(revision) })}
      </Typography>
      <ActiveTool />
      <DocumentError />
      <DocumentHistoryShortcuts />
      <FinishingDraftShortcuts />
    </div>
  );
}
