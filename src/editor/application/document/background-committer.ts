import type {
  BackgroundDraftId,
  BackgroundTypes,
  DocumentId,
  DocumentSnapshot,
  Revision,
} from "@/editor/domain";

export type BackgroundCommitInput = {
  documentId: DocumentId;
  draftId: BackgroundDraftId;
  expectedRevision: Revision;
  draftRevision: Revision;
  source: import("@/editor/domain").ArtifactId;
  snapshot: DocumentSnapshot;
  fill: BackgroundTypes.FillDescriptor;
};

export type BackgroundCommitter = {
  commit(input: BackgroundCommitInput, signal: AbortSignal): Promise<DocumentSnapshot>;
};
