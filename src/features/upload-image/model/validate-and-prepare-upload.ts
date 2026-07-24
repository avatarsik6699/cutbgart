import type { SourceImage } from "../../../entities/processed-image";
import { downscaleToFit } from "./downscale";
import type { UploadResult } from "./types";
import { inspectEncodedImageDimensions } from "@/shared/lib/image-file-inspection";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION_PX = 4096;
const MAX_DECODE_PIXELS = 40_000_000;
const ACCEPTED_FORMATS = ["image/jpeg", "image/png", "image/webp"] as const;

function isAcceptedFormat(type: string): type is SourceImage["format"] {
  return (ACCEPTED_FORMATS as readonly string[]).includes(type);
}

/**
 * Validates a raw upload (format, 20 MB size limit) and downscales it
 * client-side when it exceeds 4096px on the longest side, producing the
 * `SourceImage` the rest of the pipeline consumes (SPEC.md §1.3, §7.1).
 * Exported for unit testing — no DOM/React dependency beyond
 * `createImageBitmap`/`OffscreenCanvas`, both available in jsdom-less Vitest
 * via the same mocking pattern as `features/remove-background`'s
 * `buildSourceImage` (SPEC.md §7.7).
 */
export async function validateAndPrepareUpload(file: File): Promise<UploadResult> {
  if (!isAcceptedFormat(file.type)) {
    return {
      ok: false,
      error: {
        code: "unsupported-format",
        message: `Unsupported file format "${file.type || "unknown"}". Use JPEG, PNG, or WebP.`,
      },
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        code: "exceeds-size-limit",
        message: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is ${String(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
      },
    };
  }

  const encodedDimensions = await inspectEncodedImageDimensions(file, file.type);
  if (!encodedDimensions) {
    return {
      ok: false,
      error: {
        code: "unsupported-format",
        message: "The file is malformed or does not match its image format.",
      },
    };
  }
  if (encodedDimensions.width * encodedDimensions.height > MAX_DECODE_PIXELS) {
    return {
      ok: false,
      error: {
        code: "exceeds-resolution-limit",
        message: `Encoded image dimensions (${String(encodedDimensions.width)}x${String(encodedDimensions.height)}) exceed the safe decode limit.`,
      },
    };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {
      ok: false,
      error: {
        code: "unsupported-format",
        message: "The image is malformed and could not be decoded.",
      },
    };
  }
  const { width, height } = bitmap;

  if (Math.max(width, height) <= MAX_DIMENSION_PX) {
    bitmap.close();
    return { ok: true, image: { blob: file, width, height, format: file.type } };
  }

  const image = await downscaleToFit(bitmap, MAX_DIMENSION_PX, file.type);
  bitmap.close();
  return { ok: true, image };
}
