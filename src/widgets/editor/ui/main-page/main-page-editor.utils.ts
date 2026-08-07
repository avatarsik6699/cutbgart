import type { MainPageEditorTypes } from "./main-page-editor.types";

export function batchMainPageProjectionEqual(
  left: MainPageEditorTypes.BatchProjection,
  right: MainPageEditorTypes.BatchProjection,
): boolean {
  if (
    left.capacity.current !== right.capacity.current ||
    left.capacity.limit !== right.capacity.limit ||
    left.admissionError?.code !== right.admissionError?.code ||
    left.admissionError?.rejectedCount !== right.admissionError?.rejectedCount ||
    left.counts.active !== right.counts.active ||
    left.counts.queued !== right.counts.queued ||
    left.counts.completed !== right.counts.completed ||
    left.counts.failed !== right.counts.failed ||
    left.export.status !== right.export.status ||
    left.export.includedCount !== right.export.includedCount ||
    left.export.skippedCount !== right.export.skippedCount ||
    left.export.error !== right.export.error ||
    left.items.length !== right.items.length
  )
    return false;
  return left.items.every((item, index) => {
    const other = right.items[index];
    return (
      other !== undefined &&
      item.itemId === other.itemId &&
      item.documentId === other.documentId &&
      item.fileName === other.fileName &&
      item.status === other.status &&
      item.error?.message === other.error?.message &&
      item.error?.retryable === other.error?.retryable &&
      item.previewUrl === other.previewUrl &&
      item.queuePosition === other.queuePosition &&
      item.qualityMode === other.qualityMode &&
      item.selected === other.selected
    );
  });
}
