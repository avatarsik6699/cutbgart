import type {
  ArtifactId,
  DocumentId,
  DocumentSnapshot,
  EnhancementDraftId,
  EnhancementOperationId,
  Revision,
  RunId,
} from "@/v2/domain";

export type EnhancementCommitInput = {
  documentId: DocumentId;
  draftId: EnhancementDraftId;
  runId: RunId;
  expectedRevision: Revision;
  source: ArtifactId;
  snapshot: DocumentSnapshot;
  operationIds: readonly EnhancementOperationId[];
};

export type EnhancementCommitResult =
  { outcome: "changed"; snapshot: DocumentSnapshot } | { outcome: "unchanged" };

export type EnhancementCommitter = {
  commit(
    input: EnhancementCommitInput,
    signal: AbortSignal,
  ): Promise<EnhancementCommitResult>;
};
