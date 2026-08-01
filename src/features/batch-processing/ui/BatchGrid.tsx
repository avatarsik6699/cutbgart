import { useEffect, useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Download, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { m } from "@/paraglide/messages";
import { Button, Skeleton } from "@/shared/ui";

import type {
  BatchItem,
  BatchItemStatus,
  BatchSchedulerSnapshot,
  ModelLoadProgress,
} from "../model/types";

function progressText(progress: ModelLoadProgress): string {
  if (progress.status === "ready") return m.batchReady();
  return progress.percent === null
    ? m.preparing()
    : `${m.preparing()} ${progress.percent.toFixed(0)}%`;
}

function statusLabel(status: BatchItemStatus): string {
  return {
    queued: m.batchQueued(),
    "model-loading": m.batchLoading(),
    processing: m.batchProcessingStatus(),
    result: m.batchReady(),
    error: m.batchFailed(),
  }[status];
}

const STATUS_STYLES: Record<BatchItemStatus, string> = {
  queued: "bg-background/90 text-muted-foreground",
  "model-loading": "bg-warning/95 text-warning-foreground dark:bg-warning/90",
  processing: "bg-info/95 text-info-foreground dark:bg-info/90",
  result: "bg-success/95 text-success-foreground dark:bg-success/90",
  error: "bg-destructive/90 text-destructive-foreground",
};

function SourceThumbnail({ item }: { item: BatchItem }) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    const nextUrl = URL.createObjectURL(item.source.blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs are browser resources; creating them after mount keeps SSR deterministic and cleanup revokes each URL.
    setSourceUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [item.source.blob]);

  return (
    <div className="relative aspect-square overflow-hidden bg-muted/50">
      {sourceUrl && (item.status === "result" || item.status === "error") ? (
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
      )}
      <span
        className={`absolute left-2 top-2 rounded-full px-2 py-1 font-mono text-[0.625rem] font-medium tracking-wide uppercase ${STATUS_STYLES[item.status]}`}
      >
        {statusLabel(item.status)}
      </span>
    </div>
  );
}

function itemStatusText(item: BatchItem): string {
  const elapsed = `${(item.processingProgress.elapsedMs / 1000).toFixed(1)}s`;
  if (item.status === "processing") {
    return m.batchRemoving({ elapsed });
  }
  if (item.status === "model-loading") return m.batchPreparingModel({ elapsed });
  if (item.status === "error") return item.error?.message ?? m.batchProcessingFailed();
  if (item.status === "result") return m.batchReadyElapsed({ elapsed });
  return statusLabel(item.status);
}

function qualityModeLabel(item: BatchItem): string {
  if (item.qualityMode === "max" || item.qualityMode === "isnet-fp32")
    return m.processingModePrecise();
  if (item.qualityMode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

export function BatchGrid({
  items,
  selectedItemId,
  snapshot,
  modelLoad,
  onSelect,
  onDownload,
  onRetry,
  onRemove,
}: {
  items: BatchItem[];
  selectedItemId: string | null;
  snapshot: BatchSchedulerSnapshot;
  modelLoad?: ModelLoadProgress;
  onSelect: (id: string, trigger: HTMLButtonElement) => void;
  onDownload: (item: BatchItem) => void;
  onRetry: (id: string, trigger: HTMLButtonElement) => void;
  onRemove: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const itemMenuTriggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const queuedIds = items
    .filter((item) => item.status === "queued")
    .map((item) => item.id);

  return (
    <section
      className="flex min-w-0 flex-col gap-3 border-t border-border pt-3"
      aria-label={m.batchProcessing()}
      data-testid="batch-overview"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {m.batchImagesHeading()}
        </h3>
        <BatchStatus snapshot={snapshot} modelLoad={modelLoad} />
      </div>
      <div
        className="flex min-w-0 gap-2 overflow-x-auto pb-2 [overscroll-behavior-inline:contain]"
        data-testid="batch-filmstrip"
      >
        {items.map((item) => {
          const selectable = item.status === "result";
          const selected = selectable && selectedItemId === item.id;
          const queuePosition = queuedIds.indexOf(item.id) + 1;
          const elapsed = `${(item.processingProgress.elapsedMs / 1000).toFixed(1)}s`;
          const detail =
            item.status === "queued"
              ? m.batchWaiting({ position: queuePosition, elapsed })
              : itemStatusText(item);
          return (
            <article
              key={item.id}
              className={`group relative w-32 shrink-0 overflow-hidden rounded-lg border bg-card text-card-foreground transition-[border-color,background-color] duration-200 motion-reduce:transition-none ${
                selectable
                  ? "hover:border-foreground/30 hover:bg-accent/40"
                  : "border-border"
              } ${selected ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
            >
              <button
                type="button"
                disabled={!selectable}
                onClick={(event) => onSelect(item.id, event.currentTarget)}
                aria-pressed={selectable ? selected : undefined}
                aria-label={
                  selectable
                    ? m.batchSelectAria({ name: item.originalFileName, detail })
                    : m.batchUnavailableAria({ name: item.originalFileName, detail })
                }
                className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-wait"
              >
                <SourceThumbnail item={item} />
                <span className="block p-2">
                  <span
                    className="block truncate text-sm font-medium"
                    title={item.originalFileName}
                  >
                    {item.originalFileName}
                  </span>
                  <span
                    className="mt-1 block truncate text-[0.6875rem] text-muted-foreground"
                    data-testid="item-progress"
                  >
                    {detail}
                  </span>
                </span>
              </button>
              {item.status === "error" && item.error && (
                <details className="border-t border-border px-2 py-1.5 text-xs">
                  <summary className="cursor-pointer font-medium text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                    {m.batchErrorDetails()}
                  </summary>
                  <p className="mt-1 break-words text-muted-foreground">
                    {item.error.detail}
                  </p>
                </details>
              )}
              <Menu.Root>
                <Menu.Trigger
                  render={
                    <Button
                      ref={(node) => {
                        itemMenuTriggers.current[item.id] = node;
                      }}
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      className="absolute right-2 top-2 z-20 border border-background/70 shadow-sm"
                      aria-label={m.batchItemActions({
                        name: item.originalFileName,
                      })}
                      data-testid="batch-item-actions"
                    />
                  }
                >
                  <MoreHorizontal aria-hidden="true" />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner
                    side="bottom"
                    align="end"
                    sideOffset={6}
                    className="z-50"
                  >
                    <Menu.Popup className="min-w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                      {item.status === "result" && item.processedImage && (
                        <>
                          <Menu.Item
                            onClick={() => onDownload(item)}
                            className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                          >
                            <Download aria-hidden="true" />
                            {m.downloadPng()}
                          </Menu.Item>
                          <Menu.Item
                            onClick={() => {
                              const trigger = itemMenuTriggers.current[item.id];
                              if (trigger) onRetry(item.id, trigger);
                            }}
                            className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                          >
                            <RefreshCw aria-hidden="true" />
                            {m.reprocessMode({ mode: qualityModeLabel(item) })}
                          </Menu.Item>
                        </>
                      )}
                      {item.status === "error" && item.error?.retryable !== false && (
                        <Menu.Item
                          onClick={() => {
                            const trigger = itemMenuTriggers.current[item.id];
                            if (trigger) onRetry(item.id, trigger);
                          }}
                          className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                        >
                          <RefreshCw aria-hidden="true" />
                          {m.tryAgain()}
                        </Menu.Item>
                      )}
                      <div role="separator" className="my-1 h-px bg-border" />
                      <Menu.Item
                        onClick={() => {
                          const trigger = itemMenuTriggers.current[item.id];
                          if (trigger) onRemove(item.id, trigger);
                        }}
                        className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-destructive outline-none data-highlighted:bg-destructive/10"
                      >
                        <Trash2 aria-hidden="true" />
                        {m.removeImage()}
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function BatchStatus({
  snapshot,
  modelLoad,
}: {
  snapshot: BatchSchedulerSnapshot;
  modelLoad?: ModelLoadProgress;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="batch-status">
      <p className="sr-only" data-testid="scheduler-summary">
        {m.batchSummary({
          active: snapshot.activeCount,
          limit: snapshot.concurrencyLimit,
          queued: snapshot.queuedCount,
          done: snapshot.completedCount,
          failed: snapshot.failedCount,
          total: snapshot.totalCount,
        })}
      </p>
      <div
        className="flex h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
        data-testid="batch-status-bar"
      >
        {snapshot.completedCount > 0 && (
          <span
            className="bg-success"
            style={{
              width: `${String(
                (snapshot.completedCount / Math.max(1, snapshot.totalCount)) * 100,
              )}%`,
            }}
          />
        )}
        {snapshot.activeCount > 0 && (
          <span
            className="bg-info"
            style={{
              width: `${String(
                (snapshot.activeCount / Math.max(1, snapshot.totalCount)) * 100,
              )}%`,
            }}
          />
        )}
        {snapshot.failedCount > 0 && (
          <span
            className="bg-destructive"
            style={{
              width: `${String(
                (snapshot.failedCount / Math.max(1, snapshot.totalCount)) * 100,
              )}%`,
            }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[0.6875rem] text-muted-foreground">
        <span>{m.batchTotalCount({ count: snapshot.totalCount })}</span>
        <span aria-hidden="true">·</span>
        <span>{m.batchReadyCount({ count: snapshot.completedCount })}</span>
        {snapshot.activeCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>{m.batchActiveCount({ count: snapshot.activeCount })}</span>
          </>
        )}
        {snapshot.queuedCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>{m.batchQueuedCount({ count: snapshot.queuedCount })}</span>
          </>
        )}
        {snapshot.failedCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-destructive">
              {m.batchFailedCount({ count: snapshot.failedCount })}
            </span>
          </>
        )}
        {modelLoad && modelLoad.status !== "ready" && (
          <>
            <span aria-hidden="true">·</span>
            <span
              role="progressbar"
              aria-valuenow={modelLoad.percent ?? undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="shared-model-progress"
            >
              {progressText(modelLoad)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
