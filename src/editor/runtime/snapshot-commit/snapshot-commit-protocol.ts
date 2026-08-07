import type {
  BackgroundDraftId,
  DocumentId,
  EnhancementDraftId,
  ManualDraftId,
  MagicDraftId,
  Revision,
  RunId,
} from "@/editor/domain";

export const SNAPSHOT_COMMIT_PROTOCOL_VERSION = 3 as const;

export type SnapshotCommitCorrelation =
  | {
      documentId: DocumentId;
      draftId: ManualDraftId;
      expectedRevision: Revision;
      operation: "manual-cutout";
    }
  | {
      documentId: DocumentId;
      draftId: MagicDraftId;
      expectedRevision: Revision;
      operation: "magic-cutout";
    }
  | {
      documentId: DocumentId;
      draftId: BackgroundDraftId;
      expectedRevision: Revision;
      draftRevision: Revision;
      operation: "background";
    }
  | {
      documentId: DocumentId;
      draftId: EnhancementDraftId;
      runId: RunId;
      expectedRevision: Revision;
      operation: "enhancement";
    };

export type SnapshotCommitWorkerImage = {
  bytes: ArrayBuffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

export type SnapshotCommitWorkerBackground =
  | { type: "transparent" }
  | { type: "color"; value: `#${string}` }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      stops: readonly [
        { offset: 0; color: `#${string}` },
        { offset: 1; color: `#${string}` },
      ];
    }
  | ({ type: "image" } & SnapshotCommitWorkerImage);

export type SnapshotCommitWorkerCommand = {
  protocol: typeof SNAPSHOT_COMMIT_PROTOCOL_VERSION;
  type: "MATERIALIZE_SNAPSHOT";
  correlation: SnapshotCommitCorrelation;
  source: SnapshotCommitWorkerImage;
  foreground: SnapshotCommitWorkerImage | null;
  background: SnapshotCommitWorkerBackground;
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
    left.operation === right.operation &&
    (left.operation !== "background" ||
      (right.operation === "background" && left.draftRevision === right.draftRevision)) &&
    (left.operation !== "enhancement" ||
      (right.operation === "enhancement" && left.runId === right.runId))
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
      correlation.operation !== "magic-cutout" &&
      correlation.operation !== "background" &&
      correlation.operation !== "enhancement") ||
    (correlation.operation === "background" &&
      !Number.isSafeInteger(correlation.draftRevision)) ||
    (correlation.operation === "enhancement" && typeof correlation.runId !== "string")
  ) {
    return false;
  }
  return event.type === "SUCCEEDED"
    ? event.compositePng instanceof ArrayBuffer
    : typeof event.message === "string";
}
