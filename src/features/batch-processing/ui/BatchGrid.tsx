import { useEffect, useState } from "react";

import { m } from "@/paraglide/messages";
import {
  BatchWorkspaceRail,
  BatchWorkspaceStatus,
  Skeleton,
  type BatchWorkspaceRailItem,
  type BatchWorkspaceSummary,
} from "@/shared/ui";

import type {
  BatchItem,
  BatchSchedulerSnapshot,
  ModelLoadProgress,
} from "../model/types";

function progressText(progress: ModelLoadProgress): string {
  if (progress.status === "ready") return m.batchReady();
  return progress.percent === null
    ? m.preparing()
    : `${m.preparing()} ${progress.percent.toFixed(0)}%`;
}

function itemStatusText(item: BatchItem): string {
  const elapsed = `${(item.processingProgress.elapsedMs / 1000).toFixed(1)}s`;
  if (item.status === "processing") return m.batchRemoving({ elapsed });
  if (item.status === "model-loading") return m.batchPreparingModel({ elapsed });
  if (item.status === "error") return item.error?.message ?? m.batchProcessingFailed();
  if (item.status === "result") return m.batchReadyElapsed({ elapsed });
  return item.status === "queued" ? m.batchQueued() : m.batchProcessingStatus();
}

function qualityModeLabel(item: BatchItem): string {
  if (item.qualityMode === "max" || item.qualityMode === "isnet-fp32")
    return m.processingModePrecise();
  if (item.qualityMode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

function SourceThumbnail(props: { item: BatchItem }) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  useEffect(
    function ownSourceUrlFx() {
      const nextUrl = URL.createObjectURL(props.item.source.blob);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- effect owns the browser URL and publishes only its current handle.
      setSourceUrl(nextUrl);
      return () => URL.revokeObjectURL(nextUrl);
    },
    [props.item.source.blob],
  );
  return sourceUrl &&
    (props.item.status === "result" || props.item.status === "error") ? (
    <img
      src={sourceUrl}
      alt=""
      className="size-full object-contain p-1"
      data-testid="batch-item-thumbnail"
    />
  ) : (
    <Skeleton
      className="size-full rounded-none motion-reduce:animate-none"
      aria-hidden="true"
      data-testid="batch-item-skeleton"
    />
  );
}

function summaryFor(
  snapshot: BatchSchedulerSnapshot,
  modelLoad?: ModelLoadProgress,
): BatchWorkspaceSummary {
  return {
    active: snapshot.activeCount,
    completed: snapshot.completedCount,
    concurrencyLimit: snapshot.concurrencyLimit,
    failed: snapshot.failedCount,
    modelProgressLabel:
      modelLoad && modelLoad.status !== "ready" ? progressText(modelLoad) : undefined,
    modelProgressPercent: modelLoad?.percent,
    queued: snapshot.queuedCount,
    total: snapshot.totalCount,
  };
}

export function BatchGrid(props: {
  items: BatchItem[];
  selectedItemId: string | null;
  snapshot: BatchSchedulerSnapshot;
  modelLoad?: ModelLoadProgress;
  onSelect: (id: string, trigger: HTMLButtonElement) => void;
  onDownload: (item: BatchItem) => void;
  onRetry: (id: string, trigger: HTMLButtonElement) => void;
  onRemove: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const byId = new Map(props.items.map((item) => [item.id, item]));
  const queuedIds = props.items.filter((item) => item.status === "queued");
  const items: readonly BatchWorkspaceRailItem[] = props.items.map((item) => {
    const queuePosition = queuedIds.indexOf(item) + 1;
    const elapsed = `${(item.processingProgress.elapsedMs / 1000).toFixed(1)}s`;
    const detail =
      item.status === "queued"
        ? m.batchWaiting({ position: queuePosition, elapsed })
        : itemStatusText(item);
    return {
      canDownload: item.status === "result" && item.processedImage !== undefined,
      canRetry:
        (item.status === "result" && item.processedImage !== undefined) ||
        (item.status === "error" && item.error?.retryable !== false),
      detail,
      errorDetail: item.status === "error" ? (item.error?.detail ?? null) : null,
      id: item.id,
      name: item.originalFileName,
      previewSlot: <SourceThumbnail item={item} />,
      retryLabel:
        item.status === "result"
          ? m.reprocessMode({ mode: qualityModeLabel(item) })
          : m.tryAgain(),
      selected: item.status === "result" && props.selectedItemId === item.id,
      selectable: item.status === "result",
      status: item.status,
    };
  });
  return (
    <BatchWorkspaceRail
      items={items}
      summary={summaryFor(props.snapshot, props.modelLoad)}
      onSelect={props.onSelect}
      onRetry={props.onRetry}
      onRemove={props.onRemove}
      onDownload={(id) => {
        const item = byId.get(id);
        if (item !== undefined) props.onDownload(item);
      }}
    />
  );
}

export function BatchStatus(props: {
  snapshot: BatchSchedulerSnapshot;
  modelLoad?: ModelLoadProgress;
}) {
  return <BatchWorkspaceStatus summary={summaryFor(props.snapshot, props.modelLoad)} />;
}
