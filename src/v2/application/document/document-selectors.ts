import type {
  CommandOutcome,
  BackgroundDraft,
  DocumentState,
  DocumentStatus,
  EnhancementDraft,
  ManualCutoutDraft,
  MagicCandidateSummary,
  MagicCutoutDraft,
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
  const draft = snapshot.context.document.activeDraft;
  return draft?.kind === "manual-cutout" ? draft : null;
}

export function selectMagicDraft(
  snapshot: DocumentSnapshotLike,
): MagicCutoutDraft | null {
  const draft = snapshot.context.document.activeDraft;
  return draft?.kind === "magic-cutout" ? draft : null;
}

export function selectBackgroundDraft(
  snapshot: DocumentSnapshotLike,
): BackgroundDraft | null {
  const draft = snapshot.context.document.activeDraft;
  return draft?.kind === "background" ? draft : null;
}

export function selectEnhancementDraft(
  snapshot: DocumentSnapshotLike,
): EnhancementDraft | null {
  const draft = snapshot.context.document.activeDraft;
  return draft?.kind === "enhance" ? draft : null;
}

export function selectMagicCandidates(
  snapshot: DocumentSnapshotLike,
): readonly MagicCandidateSummary[] {
  return snapshot.context.document.magicCandidates;
}

export function selectCanUndoDocument(snapshot: DocumentSnapshotLike): boolean {
  return (
    snapshot.context.document.activeDraft === null &&
    snapshot.context.document.history.past.length > 0
  );
}

export function selectCanRedoDocument(snapshot: DocumentSnapshotLike): boolean {
  return (
    snapshot.context.document.activeDraft === null &&
    snapshot.context.document.history.future.length > 0
  );
}

export function selectHasPastDocumentHistory(snapshot: DocumentSnapshotLike): boolean {
  return snapshot.context.document.history.past.length > 0;
}

export function selectHasFutureDocumentHistory(snapshot: DocumentSnapshotLike): boolean {
  return snapshot.context.document.history.future.length > 0;
}

export function selectDocumentRevision(snapshot: DocumentSnapshotLike): Revision {
  return snapshot.context.document.revision;
}
