import type { BackgroundDraftId, DocumentId, Revision } from "@/v2/domain";

export const BACKGROUND_IMAGE_PROTOCOL_VERSION = 1 as const;
export const BACKGROUND_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const BACKGROUND_IMAGE_MAX_DIMENSION = 4096;

export type BackgroundImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export type BackgroundImageCorrelation = {
  documentId: DocumentId;
  draftId: BackgroundDraftId;
  draftRevision: Revision;
};

export type BackgroundImageWorkerCommand = {
  protocol: typeof BACKGROUND_IMAGE_PROTOCOL_VERSION;
  type: "PREPARE_BACKGROUND_IMAGE";
  correlation: BackgroundImageCorrelation;
  bytes: ArrayBuffer;
  mediaType: BackgroundImageMediaType;
};

export type BackgroundImageWorkerEvent =
  | {
      protocol: typeof BACKGROUND_IMAGE_PROTOCOL_VERSION;
      type: "SUCCEEDED";
      correlation: BackgroundImageCorrelation;
      bytes: ArrayBuffer;
      mediaType: BackgroundImageMediaType;
      width: number;
      height: number;
    }
  | {
      protocol: typeof BACKGROUND_IMAGE_PROTOCOL_VERSION;
      type: "FAILED";
      correlation: BackgroundImageCorrelation;
      message: string;
    };

export function sameBackgroundImageCorrelation(
  left: BackgroundImageCorrelation,
  right: BackgroundImageCorrelation,
): boolean {
  return (
    left.documentId === right.documentId &&
    left.draftId === right.draftId &&
    left.draftRevision === right.draftRevision
  );
}

export function isBackgroundImageWorkerEvent(
  value: unknown,
): value is BackgroundImageWorkerEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  if (
    event.protocol !== BACKGROUND_IMAGE_PROTOCOL_VERSION ||
    (event.type !== "SUCCEEDED" && event.type !== "FAILED") ||
    typeof event.correlation !== "object" ||
    event.correlation === null
  )
    return false;
  const correlation = event.correlation as Record<string, unknown>;
  if (
    typeof correlation.documentId !== "string" ||
    typeof correlation.draftId !== "string" ||
    !Number.isSafeInteger(correlation.draftRevision)
  )
    return false;
  return event.type === "FAILED"
    ? typeof event.message === "string"
    : event.bytes instanceof ArrayBuffer &&
        (event.mediaType === "image/jpeg" ||
          event.mediaType === "image/png" ||
          event.mediaType === "image/webp") &&
        Number.isSafeInteger(event.width) &&
        Number(event.width) > 0 &&
        Number(event.width) <= BACKGROUND_IMAGE_MAX_DIMENSION &&
        Number.isSafeInteger(event.height) &&
        Number(event.height) > 0 &&
        Number(event.height) <= BACKGROUND_IMAGE_MAX_DIMENSION;
}
