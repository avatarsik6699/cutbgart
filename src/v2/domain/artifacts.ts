import type {
  ArtifactId,
  BackgroundDraftId,
  DocumentId,
  EditOperationId,
  EnhancementDraftId,
  ManualDraftId,
  MagicDraftId,
  RunId,
} from "./ids";

import type { BackgroundTypes } from "./background";

export type ArtifactKind =
  "source" | "matte" | "foreground" | "composite" | "png" | "background-image";

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
  | { kind: "background-draft"; documentId: DocumentId; draftId: BackgroundDraftId }
  | { kind: "background-preview"; documentId: DocumentId; draftId: BackgroundDraftId }
  | { kind: "enhancement-draft"; documentId: DocumentId; draftId: EnhancementDraftId }
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
  background: BackgroundTypes.FillDescriptor;
};
