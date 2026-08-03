import type {
  BackgroundDraftId,
  BackgroundFillDescriptor,
  DocumentId,
  DocumentSnapshot,
  Revision,
} from "@/v2/domain";

export type BackgroundCommitInput = {
  documentId: DocumentId;
  draftId: BackgroundDraftId;
  expectedRevision: Revision;
  draftRevision: Revision;
  source: import("@/v2/domain").ArtifactId;
  snapshot: DocumentSnapshot;
  fill: BackgroundFillDescriptor;
};

export type BackgroundCommitter = {
  commit(input: BackgroundCommitInput, signal: AbortSignal): Promise<DocumentSnapshot>;
};
