import { useEffect, useState } from "react";

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
  if (progress.status === "checking-cache") return "Checking browser cache…";
  if (progress.status === "building-session") return "Building ONNX session…";
  if (progress.status === "ready")
    return progress.fromCache ? "Loaded from browser cache" : "Model ready";
  const loaded = (progress.loadedBytes / 1_048_576).toFixed(1);
  const total = progress.totalBytes
    ? ` / ${(progress.totalBytes / 1_048_576).toFixed(1)} MiB`
    : " MiB";
  return `Downloading model · ${loaded}${total}${progress.percent === null ? "" : ` · ${progress.percent.toFixed(1)}%`}`;
}

const STATUS_LABELS: Record<BatchItemStatus, string> = {
  queued: "Queued",
  "model-loading": "Loading model",
  processing: "Processing",
  result: "Ready",
  error: "Failed",
};

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
        {STATUS_LABELS[item.status]}
      </span>
    </div>
  );
}

function itemStatusText(item: BatchItem): string {
  const elapsed = `${(item.processingProgress.elapsedMs / 1000).toFixed(1)}s`;
  if (item.status === "processing") {
    return `Removing background · ${elapsed}`;
  }
  if (item.status === "model-loading") return `Preparing shared model · ${elapsed}`;
  if (item.status === "error") return item.error ?? "Processing failed";
  if (item.status === "result") return `Ready · ${elapsed}`;
  return STATUS_LABELS[item.status];
}

export function BatchGrid({
  items,
  snapshot,
  selectedItemId,
  modelLoad,
  onSelect,
  onRetry,
}: {
  items: BatchItem[];
  snapshot: BatchSchedulerSnapshot;
  selectedItemId: string | null;
  modelLoad?: ModelLoadProgress;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const queuedIds = items
    .filter((item) => item.status === "queued")
    .map((item) => item.id);

  return (
    <section className="flex flex-col gap-3" aria-label="Batch processing">
      <p className="text-sm text-muted-foreground" data-testid="scheduler-summary">
        {pathLabel(snapshot.inferencePath)} · {snapshot.activeCount}/
        {snapshot.concurrencyLimit} active · {snapshot.queuedCount} queued ·{" "}
        {snapshot.completedCount} done · {snapshot.failedCount} failed ·{" "}
        {snapshot.totalCount} total
      </p>
      {snapshot.completedCount + snapshot.failedCount < snapshot.totalCount && (
        <p
          className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
          data-testid="batch-queue-explanation"
        >
          A shared quality model is prepared once, then images are processed in upload
          order. {pathLabel(snapshot.inferencePath)} runs up to{" "}
          {snapshot.concurrencyLimit}{" "}
          {snapshot.concurrencyLimit === 1 ? "image" : "images"} at a time; queued images
          are waiting for the next available slot.
        </p>
      )}
      {modelLoad && (
        <div
          className="rounded-lg border p-3 text-sm"
          data-testid="shared-model-progress"
        >
          <p className="font-medium">Shared model setup</p>
          <p className="text-muted-foreground">{progressText(modelLoad)}</p>
          {modelLoad.percent !== null && modelLoad.status !== "ready" && (
            <progress className="w-full" max={100} value={modelLoad.percent} />
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const selectable = item.status === "result";
          const selected = selectable && selectedItemId === item.id;
          const queuePosition = queuedIds.indexOf(item.id) + 1;
          const elapsed = `${(item.processingProgress.elapsedMs / 1000).toFixed(1)}s`;
          const detail =
            item.status === "queued"
              ? `Waiting · #${queuePosition} in queue · ${elapsed}`
              : itemStatusText(item);
          return (
            <article
              key={item.id}
              className={`group overflow-hidden rounded-xl border bg-card text-card-foreground transition-[border-color,box-shadow,transform] duration-200 ${
                selectable
                  ? "hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md"
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
                    ? `Select ${item.originalFileName} for review. ${detail}`
                    : `${item.originalFileName}. ${detail}. Review available when ready.`
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
                    {item.qualityMode === "max" ? "Max" : "Fast"}
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
                        ? "Selected for review"
                        : "Select to review"
                      : "Review available when ready"}
                  </span>
                </span>
              </button>
              {item.status === "error" && (
                <button
                  type="button"
                  className="mx-3 mb-3 text-xs font-medium underline underline-offset-2"
                  onClick={() => onRetry(item.id)}
                >
                  Try again
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
