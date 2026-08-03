import type { DocumentId, ManualDraftId, Revision } from "@/v2/domain";

export const MANUAL_COMMIT_PROTOCOL_VERSION = 1 as const;

export type ManualCommitCorrelation = {
  documentId: DocumentId;
  draftId: ManualDraftId;
  expectedRevision: Revision;
};

export type ManualCommitWorkerCommand = {
  protocol: typeof MANUAL_COMMIT_PROTOCOL_VERSION;
  type: "MANUAL_CUTOUT_COMMIT";
  correlation: ManualCommitCorrelation;
  source: { bytes: ArrayBuffer; mediaType: "image/jpeg" | "image/png" | "image/webp" };
  matte: ArrayBuffer;
  width: number;
  height: number;
};

export type ManualCommitWorkerEvent =
  | {
      protocol: typeof MANUAL_COMMIT_PROTOCOL_VERSION;
      type: "SUCCEEDED";
      correlation: ManualCommitCorrelation;
      compositePng: ArrayBuffer;
    }
  | {
      protocol: typeof MANUAL_COMMIT_PROTOCOL_VERSION;
      type: "FAILED";
      correlation: ManualCommitCorrelation;
      message: string;
    };

export function sameManualCorrelation(
  left: ManualCommitCorrelation,
  right: ManualCommitCorrelation,
): boolean {
  return (
    left.documentId === right.documentId &&
    left.draftId === right.draftId &&
    left.expectedRevision === right.expectedRevision
  );
}
