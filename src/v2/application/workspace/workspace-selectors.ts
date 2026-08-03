import type { DocumentId } from "@/v2/domain";

import type { WorkspaceActorContext } from "./workspace-machine";

export type WorkspaceSnapshotLike = { context: WorkspaceActorContext };

export function selectSelectedDocumentId(
  snapshot: WorkspaceSnapshotLike,
): DocumentId | null {
  return snapshot.context.selectedDocumentId;
}

export function selectWorkspaceDocumentCount(snapshot: WorkspaceSnapshotLike): number {
  return snapshot.context.documentIds.length;
}
