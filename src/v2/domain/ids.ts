declare const artifactIdBrand: unique symbol;
declare const documentIdBrand: unique symbol;
declare const imageIdBrand: unique symbol;
declare const runIdBrand: unique symbol;
declare const manualDraftIdBrand: unique symbol;
declare const magicDraftIdBrand: unique symbol;
declare const magicCandidateIdBrand: unique symbol;
declare const editOperationIdBrand: unique symbol;

export type ArtifactId = string & { readonly [artifactIdBrand]: "ArtifactId" };
export type DocumentId = string & { readonly [documentIdBrand]: "DocumentId" };
export type ImageId = string & { readonly [imageIdBrand]: "ImageId" };
export type RunId = string & { readonly [runIdBrand]: "RunId" };
export type ManualDraftId = string & { readonly [manualDraftIdBrand]: "ManualDraftId" };
export type MagicDraftId = string & { readonly [magicDraftIdBrand]: "MagicDraftId" };
export type MagicCandidateId = string & {
  readonly [magicCandidateIdBrand]: "MagicCandidateId";
};
export type EditOperationId = string & {
  readonly [editOperationIdBrand]: "EditOperationId";
};
export type Revision = number;

function createId<TId extends string>(kind: string, value: string): TId {
  if (value.trim().length === 0) {
    throw new Error(`${kind} must not be empty`);
  }

  return value as TId;
}

export function createArtifactId(value: string): ArtifactId {
  return createId<ArtifactId>("ArtifactId", value);
}

export function createDocumentId(value: string): DocumentId {
  return createId<DocumentId>("DocumentId", value);
}

export function createImageId(value: string): ImageId {
  return createId<ImageId>("ImageId", value);
}

export function createRunId(value: string): RunId {
  return createId<RunId>("RunId", value);
}

export function createManualDraftId(value: string): ManualDraftId {
  return createId<ManualDraftId>("ManualDraftId", value);
}

export function createMagicDraftId(value: string): MagicDraftId {
  return createId<MagicDraftId>("MagicDraftId", value);
}

export function createMagicCandidateId(value: string): MagicCandidateId {
  return createId<MagicCandidateId>("MagicCandidateId", value);
}

export function createEditOperationId(value: string): EditOperationId {
  return createId<EditOperationId>("EditOperationId", value);
}

export function isRevision(value: number): value is Revision {
  return Number.isSafeInteger(value) && value >= 0;
}
