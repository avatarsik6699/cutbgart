import type {
  ArtifactId,
  DocumentId,
  EditOperationId,
  ManualDraftId,
  MagicDraftId,
  RunId,
} from "./ids";

export type ArtifactKind = "source" | "matte" | "foreground" | "composite" | "png";

export type ArtifactMediaType =
  "application/octet-stream" | "image/jpeg" | "image/png" | "image/webp";

export type ArtifactMetadata = {
  id: ArtifactId;
  kind: ArtifactKind;
  mediaType: ArtifactMediaType;
  width: number;
  height: number;
  estimatedBytes: number;
};

export type ArtifactLeaseOwner =
  | { kind: "document"; documentId: DocumentId }
  | { kind: "baseline"; documentId: DocumentId }
  | { kind: "run"; documentId: DocumentId; runId: RunId }
  | { kind: "manual-draft"; documentId: DocumentId; draftId: ManualDraftId }
  | { kind: "magic-draft"; documentId: DocumentId; draftId: MagicDraftId }
  | { kind: "history"; documentId: DocumentId; operationId: EditOperationId }
  | { kind: "preview"; documentId: DocumentId }
  | { kind: "export"; documentId: DocumentId };

export type ArtifactLease = {
  artifactId: ArtifactId;
  owner: ArtifactLeaseOwner;
};

export type ArtifactRepositoryStats = {
  artifacts: number;
  leases: number;
  objectUrls: number;
  estimatedBytes: number;
};

export type DocumentSnapshot = {
  matte: ArtifactId;
  foreground: ArtifactId | null;
  composite: ArtifactId;
};
