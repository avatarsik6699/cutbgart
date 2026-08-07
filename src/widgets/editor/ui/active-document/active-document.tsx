import { selectDocumentRevision, selectDocumentState } from "@/editor/application";
import { useRef } from "react";
import type { DocumentMachineTypes, DocumentSnapshotLike } from "@/editor/application";
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
const selectDocumentId = (snapshot: DocumentSnapshotLike) =>
  selectDocumentState(snapshot).documentId;

export function ActiveDocument(props: { actor: DocumentMachineTypes.ActorRef }) {
  return (
    <ActiveDocumentProvider actor={props.actor}>
      <ActiveDocumentWorkspace />
    </ActiveDocumentProvider>
  );
}

function ActiveDocumentWorkspace() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const documentId = useActiveDocumentActorSelector(selectDocumentId);
  const activeTool = useActiveDocumentViewSelector(selectActiveTool);

  return (
    <div
      ref={workspaceRef}
      className="tool-workspace-grid"
      data-testid="editor-tool-workspace"
      data-document-id={documentId}
      data-active-tool={activeTool}
    >
      <div className="min-w-0 overflow-hidden [grid-area:toolbar]">
        <EditorToolbarConnector />
      </div>
      <NavigationGuard editingRoot={workspaceRef} />
      <DocumentRevisionStatus />
      <ActiveTool />
      <DocumentError />
      <DocumentHistoryShortcuts />
      <FinishingDraftShortcuts />
    </div>
  );
}

function DocumentRevisionStatus() {
  const revision = useActiveDocumentActorSelector(selectDocumentRevision);
  return (
    <Typography
      variant="caption"
      as="p"
      className="sr-only"
      data-document-revision={revision}
    >
      {m.editorRevision({ revision: String(revision) })}
    </Typography>
  );
}
