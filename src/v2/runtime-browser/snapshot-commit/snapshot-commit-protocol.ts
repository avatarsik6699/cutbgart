import type { DocumentId, ManualDraftId, MagicDraftId, Revision } from "@/v2/domain";

export const SNAPSHOT_COMMIT_PROTOCOL_VERSION = 1 as const;

export type SnapshotCommitCorrelation = {
  documentId: DocumentId;
  draftId: ManualDraftId | MagicDraftId;
  expectedRevision: Revision;
  operation: "manual-cutout" | "magic-cutout";
};

export type SnapshotCommitWorkerCommand = {
  protocol: typeof SNAPSHOT_COMMIT_PROTOCOL_VERSION;
  type: "MATERIALIZE_SNAPSHOT";
  correlation: SnapshotCommitCorrelation;
  source: { bytes: ArrayBuffer; mediaType: "image/jpeg" | "image/png" | "image/webp" };
  matte: ArrayBuffer;
  width: number;
  height: number;
};

export type SnapshotCommitWorkerEvent =
  | {
      protocol: typeof SNAPSHOT_COMMIT_PROTOCOL_VERSION;
      type: "SUCCEEDED";
      correlation: SnapshotCommitCorrelation;
      compositePng: ArrayBuffer;
    }
  | {
      protocol: typeof SNAPSHOT_COMMIT_PROTOCOL_VERSION;
      type: "FAILED";
      correlation: SnapshotCommitCorrelation;
      message: string;
    };

export function sameSnapshotCommitCorrelation(
  left: SnapshotCommitCorrelation,
  right: SnapshotCommitCorrelation,
): boolean {
  return (
    left.documentId === right.documentId &&
    left.draftId === right.draftId &&
    left.expectedRevision === right.expectedRevision &&
    left.operation === right.operation
  );
}

export function isSnapshotCommitWorkerEvent(
  value: unknown,
): value is SnapshotCommitWorkerEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  if (
    event.protocol !== SNAPSHOT_COMMIT_PROTOCOL_VERSION ||
    (event.type !== "SUCCEEDED" && event.type !== "FAILED") ||
    typeof event.correlation !== "object" ||
    event.correlation === null
  ) {
    return false;
  }
  const correlation = event.correlation as Record<string, unknown>;
  if (
    typeof correlation.documentId !== "string" ||
    typeof correlation.draftId !== "string" ||
    !Number.isSafeInteger(correlation.expectedRevision) ||
    (correlation.operation !== "manual-cutout" &&
      correlation.operation !== "magic-cutout")
  ) {
    return false;
  }
  return event.type === "SUCCEEDED"
    ? event.compositePng instanceof ArrayBuffer
    : typeof event.message === "string";
}
