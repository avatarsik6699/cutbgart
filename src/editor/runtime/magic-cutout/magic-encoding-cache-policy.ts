import type { DocumentId } from "@/editor/domain";

export function magicEncodingCacheKey(input: {
  documentId: DocumentId;
  height: number;
  mediaType: string;
  width: number;
}): string {
  return [input.documentId, input.mediaType, input.width, input.height].join(":");
}
