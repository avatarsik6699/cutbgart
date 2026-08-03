import { inspectEncodedImageDimensions } from "@/shared/lib";
import type { ArtifactMediaType } from "@/v2/domain";

import type { EditorImportError } from "./editor-session.types";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PreparedImageImport = {
  file: File;
  height: number;
  mediaType: Extract<ArtifactMediaType, `image/${string}`>;
  width: number;
};

export type ImageImportPreparation =
  { ok: true; value: PreparedImageImport } | { ok: false; error: EditorImportError };

export async function prepareImageImport(file: File): Promise<ImageImportPreparation> {
  const mediaType = SUPPORTED_MEDIA_TYPES.find((candidate) => candidate === file.type);
  if (mediaType === undefined) return { ok: false, error: "unsupported-file" };
  const dimensions = await inspectEncodedImageDimensions(file, mediaType);
  if (dimensions === null) return { ok: false, error: "invalid-image" };
  return { ok: true, value: { file, mediaType, ...dimensions } };
}
