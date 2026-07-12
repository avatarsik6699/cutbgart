import type { SourceImage } from "../../../entities/processed-image";

/**
 * `useBackgroundRemoval.selectFile` (Phase 02, `features/remove-background`
 * — not modified this phase) takes a raw `File`, while `upload-image`'s
 * `validateAndPrepareUpload` already produces a validated/downscaled
 * `SourceImage`. Re-wrapping its blob as a `File` reuses the existing hook
 * API unchanged instead of widening `remove-background`'s public contract.
 */
export function sourceImageToFile(image: SourceImage): File {
  return new File([image.blob], "upload", { type: image.format });
}
