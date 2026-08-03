import type {
  ArtifactId,
  DocumentId,
  DocumentSnapshot,
  ManualDraftId,
  Revision,
} from "@/v2/domain";

export type ManualCutoutCommitRequest = {
  documentId: DocumentId;
  draftId: ManualDraftId;
  expectedRevision: Revision;
  source: ArtifactId;
  draftMatte: ArtifactId;
  foreground: DocumentSnapshot["foreground"];
  background: DocumentSnapshot["background"];
};

export type ManualCutoutCommitter = {
  commit(
    request: ManualCutoutCommitRequest,
    signal: AbortSignal,
  ): Promise<DocumentSnapshot>;
};
