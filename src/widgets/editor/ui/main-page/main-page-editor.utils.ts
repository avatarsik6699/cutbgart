import type { MainPageEditorTypes } from "./main-page-editor.types";

type BatchItem = MainPageEditorTypes.BatchProjection["items"][number];

function batchItemIdentityEqual(item: BatchItem, other: BatchItem): boolean {
  return (
    item.itemId === other.itemId &&
    item.documentId === other.documentId &&
    item.fileName === other.fileName
  );
}

function batchItemStatusEqual(item: BatchItem, other: BatchItem): boolean {
  return (
    item.status === other.status &&
    item.error?.message === other.error?.message &&
    item.error?.retryable === other.error?.retryable
  );
}

function batchItemPresentationEqual(item: BatchItem, other: BatchItem): boolean {
  return (
    item.previewUrl === other.previewUrl &&
    item.queuePosition === other.queuePosition &&
    item.qualityMode === other.qualityMode &&
    item.selected === other.selected
  );
}

function batchItemEqual(item: BatchItem, other: BatchItem | undefined): boolean {
  if (other === undefined) return false;
  return (
    batchItemIdentityEqual(item, other) &&
    batchItemStatusEqual(item, other) &&
    batchItemPresentationEqual(item, other)
  );
}

function batchCapacityEqual(
  left: MainPageEditorTypes.BatchProjection,
  right: MainPageEditorTypes.BatchProjection,
): boolean {
  return (
    left.capacity.current === right.capacity.current &&
    left.capacity.limit === right.capacity.limit &&
    left.admissionError?.code === right.admissionError?.code &&
    left.admissionError?.rejectedCount === right.admissionError?.rejectedCount
  );
}

function batchCountsEqual(
  left: MainPageEditorTypes.BatchProjection,
  right: MainPageEditorTypes.BatchProjection,
): boolean {
  return (
    left.counts.active === right.counts.active &&
    left.counts.queued === right.counts.queued &&
    left.counts.completed === right.counts.completed &&
    left.counts.failed === right.counts.failed
  );
}

function batchExportEqual(
  left: MainPageEditorTypes.BatchProjection,
  right: MainPageEditorTypes.BatchProjection,
): boolean {
  return (
    left.export.status === right.export.status &&
    left.export.includedCount === right.export.includedCount &&
    left.export.skippedCount === right.export.skippedCount &&
    left.export.error === right.export.error
  );
}

function batchSummaryEqual(
  left: MainPageEditorTypes.BatchProjection,
  right: MainPageEditorTypes.BatchProjection,
): boolean {
  return (
    batchCapacityEqual(left, right) &&
    batchCountsEqual(left, right) &&
    batchExportEqual(left, right) &&
    left.items.length === right.items.length
  );
}

export function batchMainPageProjectionEqual(
  left: MainPageEditorTypes.BatchProjection,
  right: MainPageEditorTypes.BatchProjection,
): boolean {
  return (
    batchSummaryEqual(left, right) &&
    left.items.every((item, index) => batchItemEqual(item, right.items[index]))
  );
}
