import type {
  DocumentId,
  DocumentSnapshot,
  MagicCandidateId,
  MagicDraftId,
  Revision,
} from "@/v2/domain";

export type MagicCutoutCommitInput = {
  documentId: DocumentId;
  draftId: MagicDraftId;
  candidateId: MagicCandidateId;
  expectedRevision: Revision;
  draftRevision: Revision;
};

export type MagicCutoutCommitter = {
  commit(input: MagicCutoutCommitInput, signal: AbortSignal): Promise<DocumentSnapshot>;
};
