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
  foreground: DocumentSnapshot["foreground"];
  background: DocumentSnapshot["background"];
};

export type MagicCutoutCommitter = {
  commit(input: MagicCutoutCommitInput, signal: AbortSignal): Promise<DocumentSnapshot>;
};
