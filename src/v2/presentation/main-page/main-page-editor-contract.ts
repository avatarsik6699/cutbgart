import type { AutomaticModelMode } from "@/shared/lib";
import type { DocumentId, ExportSize, WorkspaceItemId } from "@/v2/domain";
import type { BatchExportSnapshot, WorkspaceItemStatus } from "@/v2/runtime-browser";
export type { ExportSize } from "@/v2/domain";

export type MainPageEditorIntent =
  | { type: "choose-files"; files: readonly File[] }
  | { type: "choose-quality"; mode: AutomaticModelMode }
  | { type: "cancel" }
  | { type: "retry" }
  | { type: "reset" }
  | { type: "choose-export-size"; size: ExportSize }
  | { type: "download-selected" }
  | { type: "begin-manual" }
  | { type: "begin-magic" }
  | { type: "begin-background" }
  | { type: "begin-enhancements" }
  | { type: "undo-document" }
  | { type: "redo-document" }
  | { type: "focus-restored" };

export type MainPageEditorProjection = Readonly<{
  admissionError:
    | "unsupported-file"
    | "exceeds-size-limit"
    | "invalid-image"
    | "preparation-failed"
    | "multiple-files"
    | null;
  canRedoDocument: boolean;
  canUndoDocument: boolean;
  exportError: string | null;
  exportStatus: "idle" | "preparing" | "succeeded" | "cancelled" | "error";
  fallbackUsed: boolean;
  height: number | null;
  inferencePath: "webgpu" | "wasm";
  locale: "ru" | "en";
  phase: "empty" | "preparing" | "loading-model" | "processing" | "result" | "error";
  qualityMode: AutomaticModelMode;
  exportSize: ExportSize;
  progressPercent: number | null;
  retryable: boolean;
  restoreFocusTool: "manual" | "magic" | "background" | "enhancements" | null;
  revision: number;
  sourcePreviewUrl: string | null;
  committedResultUrl: string | null;
  width: number | null;
}>;

export type BatchMainPageItemProjection = Readonly<{
  itemId: WorkspaceItemId;
  documentId: DocumentId | null;
  fileName: string;
  status: WorkspaceItemStatus;
  error: Readonly<{ message: string; retryable: boolean }> | null;
  previewUrl: string | null;
  queuePosition: number | null;
  qualityMode: AutomaticModelMode;
  selected: boolean;
}>;

export type BatchMainPageProjection = Readonly<{
  items: readonly BatchMainPageItemProjection[];
  capacity: Readonly<{ current: number; limit: 20 }>;
  admissionError: Readonly<{
    code: "capacity-exceeded";
    rejectedCount: number;
  }> | null;
  counts: Readonly<{
    active: number;
    queued: number;
    completed: number;
    failed: number;
  }>;
  export: BatchExportSnapshot;
}>;

export type BatchMainPageIntent =
  | { type: "add-files"; files: readonly File[] }
  | { type: "select-item"; documentId: DocumentId }
  | { type: "retry-item"; itemId: WorkspaceItemId }
  | { type: "remove-item"; itemId: WorkspaceItemId }
  | { type: "download-item"; documentId: DocumentId }
  | { type: "clear-batch" }
  | { type: "cancel-download-all" }
  | { type: "download-all" };

export function batchMainPageProjectionEqual(
  left: BatchMainPageProjection,
  right: BatchMainPageProjection,
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

/**
 * The presentation owns no workflow state. It renders one immutable value and
 * reports user actions through this single boundary; the v2 adapter translates
 * those actions to application/runtime owners.
 */
export type MainPageEditorPresentationProps = Readonly<{
  projection: MainPageEditorProjection;
  onIntent: (intent: MainPageEditorIntent) => void;
  batch?: BatchMainPageProjection;
  onBatchIntent?: (intent: BatchMainPageIntent) => void;
}>;
