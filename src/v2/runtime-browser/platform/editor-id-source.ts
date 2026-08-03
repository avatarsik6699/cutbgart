import {
  createArtifactId,
  createDocumentId,
  createImageId,
  createRunId,
  type ArtifactId,
  type DocumentId,
  type ImageId,
  type RunId,
} from "@/v2/domain";

export type EditorIdSource = {
  artifact: () => ArtifactId;
  document: () => DocumentId;
  image: () => ImageId;
  run: () => RunId;
};

export function createNativeEditorIdSource(
  randomUuid: () => string = () => crypto.randomUUID(),
): EditorIdSource {
  return {
    artifact: () => createArtifactId(randomUuid()),
    document: () => createDocumentId(randomUuid()),
    image: () => createImageId(randomUuid()),
    run: () => createRunId(randomUuid()),
  };
}
