import type {
  CommandOutcome,
  DocumentState,
  DocumentStatus,
  ManualCutoutDraft,
  Revision,
} from "@/v2/domain";

import type { DocumentActorContext } from "./document-machine.types";

export type DocumentSnapshotLike = { context: DocumentActorContext };

export function selectDocumentState(snapshot: DocumentSnapshotLike): DocumentState {
  return snapshot.context.document;
}

export function selectDocumentStatus(snapshot: DocumentSnapshotLike): DocumentStatus {
  return snapshot.context.document.status;
}

export function selectDocumentProgress(snapshot: DocumentSnapshotLike): number | null {
  return snapshot.context.document.progress;
}

export function selectDocumentError(snapshot: DocumentSnapshotLike): string | null {
  return snapshot.context.document.error?.message ?? null;
}

export function selectLastDocumentCommandOutcome(
  snapshot: DocumentSnapshotLike,
): CommandOutcome | null {
  return snapshot.context.lastCommandOutcome;
}

export function selectManualDraft(
  snapshot: DocumentSnapshotLike,
): ManualCutoutDraft | null {
  return snapshot.context.document.manualDraft;
}

export function selectCanUndoDocument(snapshot: DocumentSnapshotLike): boolean {
  return (
    snapshot.context.document.manualDraft === null &&
    snapshot.context.document.history.past.length > 0
  );
}

export function selectCanRedoDocument(snapshot: DocumentSnapshotLike): boolean {
  return (
    snapshot.context.document.manualDraft === null &&
    snapshot.context.document.history.future.length > 0
  );
}

export function selectDocumentRevision(snapshot: DocumentSnapshotLike): Revision {
  return snapshot.context.document.revision;
}
