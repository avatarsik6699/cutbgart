import { inspectEncodedImageDimensions } from "@/shared/lib";
import type { ArtifactMediaType } from "@/v2/domain";

import type { EditorSessionTypes } from "./editor-session.types";
import { resizeImageInWorker } from "../export";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const IMAGE_IMPORT_MAX_DIMENSION = 4096;

export type PreparedImageImport = {
  file: File;
  height: number;
  mediaType: Extract<ArtifactMediaType, `image/${string}`>;
  width: number;
};

export type ImageImportPreparation =
  | { ok: true; value: PreparedImageImport }
  | { ok: false; error: EditorSessionTypes.ImportError };

type ImageImportRuntime = Readonly<{
  resize(
    file: File,
    width: number,
    height: number,
    mediaType: PreparedImageImport["mediaType"],
    signal?: AbortSignal,
  ): Promise<Blob>;
}>;

const browserRuntime: ImageImportRuntime = {
  resize: (file, width, height, mediaType, signal) =>
    resizeImageInWorker(file, { width, height }, mediaType, signal),
};

export async function prepareImageImport(
  file: File,
  runtime: ImageImportRuntime = browserRuntime,
  signal?: AbortSignal,
): Promise<ImageImportPreparation> {
  if (signal?.aborted)
    throw new DOMException("Image preparation cancelled", "AbortError");
  const mediaType = SUPPORTED_MEDIA_TYPES.find((candidate) => candidate === file.type);
  if (mediaType === undefined) return { ok: false, error: "unsupported-file" };
  if (file.size > IMAGE_IMPORT_MAX_BYTES)
    return { ok: false, error: "exceeds-size-limit" };
  const dimensions = await inspectEncodedImageDimensions(file, mediaType);
  if (signal?.aborted)
    throw new DOMException("Image preparation cancelled", "AbortError");
  if (dimensions === null) return { ok: false, error: "invalid-image" };
  if (Math.max(dimensions.width, dimensions.height) > IMAGE_IMPORT_MAX_DIMENSION) {
    try {
      const scale =
        IMAGE_IMPORT_MAX_DIMENSION / Math.max(dimensions.width, dimensions.height);
      const width = Math.max(1, Math.round(dimensions.width * scale));
      const height = Math.max(1, Math.round(dimensions.height * scale));
      const blob = await runtime.resize(file, width, height, mediaType, signal);
      if (signal?.aborted)
        throw new DOMException("Image preparation cancelled", "AbortError");
      return {
        ok: true,
        value: {
          file: new File([blob], file.name, { type: mediaType }),
          height,
          mediaType,
          width,
        },
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return { ok: false, error: "preparation-failed" };
    }
  }
  return { ok: true, value: { file, mediaType, ...dimensions } };
}
