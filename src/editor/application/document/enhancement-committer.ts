import type {
  ArtifactId,
  DocumentId,
  DocumentSnapshot,
  EnhancementDraftId,
  EnhancementTypes,
  Revision,
  RunId,
} from "@/editor/domain";

export type EnhancementCommitInput = {
  documentId: DocumentId;
  draftId: EnhancementDraftId;
  runId: RunId;
  expectedRevision: Revision;
  source: ArtifactId;
  snapshot: DocumentSnapshot;
  operationIds: readonly EnhancementTypes.OperationId[];
};

export type EnhancementCommitResult =
  { outcome: "changed"; snapshot: DocumentSnapshot } | { outcome: "unchanged" };

export type EnhancementCommitter = {
  commit(
    input: EnhancementCommitInput,
    signal: AbortSignal,
  ): Promise<EnhancementCommitResult>;
};
