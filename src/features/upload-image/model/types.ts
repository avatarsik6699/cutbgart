import type { SourceImage } from "../../../entities/processed-image";

export type UploadErrorCode =
  | "unsupported-format" // SPEC.md §7.3: clear error, unsupported format
  | "exceeds-size-limit" // SPEC.md §1.3: 20 MB hard limit
  | "exceeds-resolution-limit"; // SPEC.md §1.3: >4096px longest side — reserved for a
// downscale failure; normal >4096px uploads are downscaled by
// `validateAndPrepareUpload`, not rejected (see its doc comment).

export interface UploadValidationError {
  code: UploadErrorCode;
  message: string;
}

export type UploadResult =
  { ok: true; image: SourceImage } | { ok: false; error: UploadValidationError };
