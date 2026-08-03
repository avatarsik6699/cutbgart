import {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
  createEditOperationId,
  createEnhancementDraftId,
  createImageId,
  createManualDraftId,
  createMagicDraftId,
  createMagicCandidateId,
  createRunId,
  type ArtifactId,
  type BackgroundDraftId,
  type DocumentId,
  type EditOperationId,
  type EnhancementDraftId,
  type ImageId,
  type ManualDraftId,
  type MagicDraftId,
  type MagicCandidateId,
  type RunId,
} from "@/v2/domain";

export type EditorIdSource = {
  artifact: () => ArtifactId;
  document: () => DocumentId;
  image: () => ImageId;
  run: () => RunId;
  manualDraft: () => ManualDraftId;
  magicDraft: () => MagicDraftId;
  magicCandidate: () => MagicCandidateId;
  backgroundDraft: () => BackgroundDraftId;
  enhancementDraft: () => EnhancementDraftId;
  editOperation: () => EditOperationId;
};

export function createNativeEditorIdSource(
  randomUuid: () => string = () => crypto.randomUUID(),
): EditorIdSource {
  return {
    artifact: () => createArtifactId(randomUuid()),
    document: () => createDocumentId(randomUuid()),
    image: () => createImageId(randomUuid()),
    run: () => createRunId(randomUuid()),
    manualDraft: () => createManualDraftId(randomUuid()),
    magicDraft: () => createMagicDraftId(randomUuid()),
    magicCandidate: () => createMagicCandidateId(randomUuid()),
    backgroundDraft: () => createBackgroundDraftId(randomUuid()),
    enhancementDraft: () => createEnhancementDraftId(randomUuid()),
    editOperation: () => createEditOperationId(randomUuid()),
  };
}
