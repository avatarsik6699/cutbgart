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
};

export type ManualCutoutCommitter = {
  commit(
    request: ManualCutoutCommitRequest,
    signal: AbortSignal,
  ): Promise<DocumentSnapshot>;
};
