import { m } from "@/paraglide/messages";
import { memo } from "react";
import { BatchWorkspaceRail, Skeleton, type BatchWorkspaceRailItem } from "@/shared/ui";
import { Image } from "@/v2/shared/ui";
import { batchMainPageProjectionEqual } from "./main-page-editor-contract";

import type {
  BatchMainPageIntent,
  BatchMainPageProjection,
} from "./main-page-editor-contract";

function qualityLabel(item: BatchMainPageProjection["items"][number]): string {
  if (item.qualityMode === "isnet-fp32") return m.processingModePrecise();
  if (item.qualityMode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

function detailText(item: BatchMainPageProjection["items"][number]): string {
  if (item.status === "queued" && item.queuePosition !== null)
    return m.editorV2QueuePosition({ position: String(item.queuePosition) });
  if (item.status === "preparing") return m.editorV2BatchPreparing();
  if (item.status === "model-loading") return m.batchLoading();
  if (item.status === "processing") return m.editorV2BatchProcessing();
  if (item.status === "result") return m.editorV2BatchResult();
  return item.error?.message ?? m.editorV2BatchError();
}

type Props = {
  batch: BatchMainPageProjection;
  onIntent: (intent: BatchMainPageIntent) => void;
};

function MainPageBatchRailView(props: Props) {
  const byId = new Map<string, BatchMainPageProjection["items"][number]>(
    props.batch.items.map((item) => [item.itemId, item]),
  );
  const items: readonly BatchWorkspaceRailItem[] = props.batch.items.map((item) => ({
    canDownload: item.status === "result" && item.documentId !== null,
    canRetry:
      item.status === "result" ||
      (item.status === "error" && item.error?.retryable !== false),
    detail: detailText(item),
    errorDetail:
      item.status === "error" ? (item.error?.message ?? m.editorV2BatchError()) : null,
    id: item.itemId,
    name: item.fileName,
    previewSlot:
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
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {m.batchCapacityExceeded({
            limit: String(props.batch.capacity.limit),
            rejected: String(props.batch.admissionError.rejectedCount),
          })}
        </p>
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
          if (documentId !== null && documentId !== undefined)
            props.onIntent({ type: "select-item", documentId });
        }}
        onDownload={(id) => {
          const documentId = byId.get(id)?.documentId;
          if (documentId !== null && documentId !== undefined)
            props.onIntent({ type: "download-item", documentId });
        }}
        onRetry={(id) => {
          const itemId = byId.get(id)?.itemId;
          if (itemId !== undefined) props.onIntent({ type: "retry-item", itemId });
        }}
        onRemove={(id) => {
          const itemId = byId.get(id)?.itemId;
          if (itemId !== undefined) props.onIntent({ type: "remove-item", itemId });
        }}
      />
      {props.batch.export.error ? (
        <p role="alert" className="text-sm text-destructive">
          {props.batch.export.error}
        </p>
      ) : null}
      {props.batch.export.includedCount > 0 ? (
        <p role="status" className="font-mono text-xs text-muted-foreground">
          {m.editorV2DownloadAllSummary({
            included: String(props.batch.export.includedCount),
            skipped: String(props.batch.export.skippedCount),
          })}
        </p>
      ) : null}
    </div>
  );
}

export const MainPageBatchRail = memo(
  MainPageBatchRailView,
  (previous, next) =>
    previous.onIntent === next.onIntent &&
    batchMainPageProjectionEqual(previous.batch, next.batch),
);
