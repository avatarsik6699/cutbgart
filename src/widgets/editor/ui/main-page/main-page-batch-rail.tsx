import { m } from "@/paraglide/messages";
import { memo } from "react";
import {
  BatchWorkspaceRail,
  Image,
  Skeleton,
  Typography,
  type BatchWorkspaceRailItem,
} from "@/shared/ui";
import { batchMainPageProjectionEqual } from "./main-page-editor.utils";
import { BatchAdmissionError } from "./image-admission";

import type { MainPageEditorTypes } from "./main-page-editor.types";
import type { DocumentId, WorkspaceItemId } from "@/editor/domain";

function qualityLabel(
  item: MainPageEditorTypes.BatchProjection["items"][number],
): string {
  if (item.qualityMode === "isnet-fp32") return m.processingModePrecise();
  if (item.qualityMode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

function detailText(item: MainPageEditorTypes.BatchProjection["items"][number]): string {
  if (item.status === "queued" && item.queuePosition !== null)
    return m.editorQueuePosition({ position: String(item.queuePosition) });
  if (item.status === "preparing") return m.editorBatchPreparing();
  if (item.status === "model-loading") return m.batchLoading();
  if (item.status === "processing") return m.editorBatchProcessing();
  if (item.status === "result") return m.editorBatchResult();
  return item.error?.message ?? m.editorBatchError();
}

type Props = {
  batch: MainPageEditorTypes.BatchProjection;
  onDownload: (documentId: DocumentId) => void;
  onRemove: (itemId: WorkspaceItemId) => void;
  onRetry: (itemId: WorkspaceItemId) => void;
  onSelect: (documentId: DocumentId) => void;
};

function MainPageBatchRailView(props: Props) {
  const byId = new Map<string, MainPageEditorTypes.BatchProjection["items"][number]>(
    props.batch.items.map((item) => [item.itemId, item]),
  );
  const items: readonly BatchWorkspaceRailItem[] = props.batch.items.map((item) => ({
    canDownload: item.status === "result" && item.documentId !== null,
    canRetry:
      item.status === "result" ||
      (item.status === "error" && item.error?.retryable !== false),
    detail: detailText(item),
    errorDetail:
      item.status === "error" ? (item.error?.message ?? m.editorBatchError()) : null,
    id: item.itemId,
    name: item.fileName,
    PreviewSlot:
      item.previewUrl !== null &&
      (item.status === "result" || item.status === "error") ? (
        <Image
          src={item.previewUrl}
          decorative
          preset="thumbnail"
          className="size-full object-contain p-1"
          data-testid="batch-item-thumbnail"
        />
      ) : (
        <Skeleton
          className="size-full rounded-none motion-reduce:animate-none"
          aria-hidden="true"
          data-testid="batch-item-skeleton"
        />
      ),
    retryLabel:
      item.status === "result"
        ? m.reprocessMode({ mode: qualityLabel(item) })
        : m.tryAgain(),
    selected: item.selected,
    selectable: item.status === "result" && item.documentId !== null,
    status: item.status,
  }));
  return (
    <div className="space-y-3">
      {props.batch.admissionError ? (
        <BatchAdmissionError
          admissionError={props.batch.admissionError}
          limit={props.batch.capacity.limit}
        />
      ) : null}
      <BatchWorkspaceRail
        items={items}
        summary={{
          active: props.batch.counts.active,
          completed: props.batch.counts.completed,
          concurrencyLimit: 1,
          failed: props.batch.counts.failed,
          queued: props.batch.counts.queued,
          total: props.batch.items.length,
        }}
        onSelect={(id) => {
          const documentId = byId.get(id)?.documentId;
          if (documentId !== null && documentId !== undefined) props.onSelect(documentId);
        }}
        onDownload={(id) => {
          const documentId = byId.get(id)?.documentId;
          if (documentId !== null && documentId !== undefined)
            props.onDownload(documentId);
        }}
        onRetry={(id) => {
          const itemId = byId.get(id)?.itemId;
          if (itemId !== undefined) props.onRetry(itemId);
        }}
        onRemove={(id) => {
          const itemId = byId.get(id)?.itemId;
          if (itemId !== undefined) props.onRemove(itemId);
        }}
      />
      {props.batch.export.error ? (
        <Typography variant="body-small" as="p" role="alert" className="text-destructive">
          {props.batch.export.error}
        </Typography>
      ) : null}
      {props.batch.export.includedCount > 0 ? (
        <Typography
          variant="caption"
          as="p"
          role="status"
          className="font-mono text-muted-foreground"
        >
          {m.editorDownloadAllSummary({
            included: String(props.batch.export.includedCount),
            skipped: String(props.batch.export.skippedCount),
          })}
        </Typography>
      ) : null}
    </div>
  );
}

export const MainPageBatchRail = memo(
  MainPageBatchRailView,
  (previous, next) =>
    previous.onDownload === next.onDownload &&
    previous.onRemove === next.onRemove &&
    previous.onRetry === next.onRetry &&
    previous.onSelect === next.onSelect &&
    batchMainPageProjectionEqual(previous.batch, next.batch),
);
