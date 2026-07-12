import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages";

import type {
  BatchItem,
  BatchItemStatus,
  BatchSchedulerSnapshot,
  ModelLoadProgress,
} from "../model/types";

function pathLabel(path: BatchSchedulerSnapshot["inferencePath"]) {
  return path === "webgpu" ? "WebGPU" : "WASM";
}

function progressText(progress: ModelLoadProgress): string {
  if (progress.status === "checking-cache") return m.batchCheckingCache();
  if (progress.status === "building-session") return m.batchBuildingSession();
  if (progress.status === "ready")
    return progress.fromCache ? m.batchModelCached() : m.batchModelReady();
  const loaded = (progress.loadedBytes / 1_048_576).toFixed(1);
  const total = progress.totalBytes
    ? ` / ${(progress.totalBytes / 1_048_576).toFixed(1)} MiB`
    : " MiB";
  return m.batchDownloadingModel({
    loaded,
    total,
    percent: progress.percent === null ? "" : ` · ${progress.percent.toFixed(1)}%`,
  });
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
  "model-loading":
    "bg-amber-100/95 text-amber-900 dark:bg-amber-950/90 dark:text-amber-200",
  processing: "bg-blue-100/95 text-blue-900 dark:bg-blue-950/90 dark:text-blue-200",
  result:
    "bg-emerald-100/95 text-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-200",
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
    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
      {sourceUrl ? (
        <img
          src={sourceUrl}
          alt=""
          className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          data-testid="batch-item-thumbnail"
        />
      ) : (
        <div className="size-full animate-pulse bg-muted" aria-hidden="true" />
      )}
      <span
        className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[0.6875rem] font-medium shadow-sm ${STATUS_STYLES[item.status]}`}
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
  if (item.status === "error") return item.error ?? m.batchProcessingFailed();
  if (item.status === "result") return m.batchReadyElapsed({ elapsed });
  return statusLabel(item.status);
}

export function BatchGrid({
  items,
  selectedItemId,
  onSelect,
  onRetry,
}: {
  items: BatchItem[];
  selectedItemId: string | null;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const queuedIds = items
    .filter((item) => item.status === "queued")
    .map((item) => item.id);

  return (
    <section className="flex flex-col gap-4" aria-label={m.batchProcessing()}>
      <div>
        <h3 className="text-sm font-semibold">{m.batchImagesHeading()}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{m.batchImagesHint()}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
              className={`group overflow-hidden rounded-xl border bg-card text-card-foreground transition-[border-color,box-shadow] duration-200 ${
                selectable
                  ? "hover:border-foreground/30 hover:shadow-sm"
                  : "border-border"
              } ${selected ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
            >
              <button
                type="button"
                disabled={!selectable}
                onClick={() => onSelect(item.id)}
                aria-pressed={selectable ? selected : undefined}
                aria-label={
                  selectable
                    ? m.batchSelectAria({ name: item.originalFileName, detail })
                    : m.batchUnavailableAria({ name: item.originalFileName, detail })
                }
                className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-wait"
              >
                <SourceThumbnail item={item} />
                <span className="block p-3">
                  <span
                    className="block truncate text-sm font-medium"
                    title={item.originalFileName}
                  >
                    {item.originalFileName}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {item.source.width} × {item.source.height} ·{" "}
                    {item.qualityMode === "max" ? m.qualityMax() : m.qualityFast()}
                  </span>
                  <span
                    className="mt-2 block text-xs text-muted-foreground"
                    data-testid="item-progress"
                  >
                    {detail}
                  </span>
                  {(item.status === "model-loading" || item.status === "processing") && (
                    <progress
                      aria-hidden="true"
                      data-testid="item-stage-progress"
                      className="mt-2 h-1 w-full"
                    />
                  )}
                  <span className="mt-2 block text-xs font-medium text-foreground/70 transition-colors group-hover:text-foreground">
                    {selectable
                      ? selected
                        ? m.batchSelected()
                        : m.batchSelect()
                      : m.batchReviewWhenReady()}
                  </span>
                </span>
              </button>
              {item.status === "error" && (
                <button
                  type="button"
                  className="mx-3 mb-3 text-xs font-medium underline underline-offset-2"
                  onClick={() => onRetry(item.id)}
                >
                  {m.tryAgain()}
                </button>
              )}
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
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" data-testid="scheduler-summary">
        {m.batchSummary({
          path: pathLabel(snapshot.inferencePath),
          active: snapshot.activeCount,
          limit: snapshot.concurrencyLimit,
          queued: snapshot.queuedCount,
          done: snapshot.completedCount,
          failed: snapshot.failedCount,
          total: snapshot.totalCount,
        })}
      </p>
      {modelLoad && (
        <div
          className="rounded-xl border bg-background/70 p-3 text-sm"
          data-testid="shared-model-progress"
        >
          <p className="font-medium">{m.batchSharedModel()}</p>
          <p className="text-muted-foreground">{progressText(modelLoad)}</p>
          {modelLoad.percent !== null && modelLoad.status !== "ready" && (
            <progress className="mt-2 w-full" max={100} value={modelLoad.percent} />
          )}
        </div>
      )}
    </div>
  );
}
