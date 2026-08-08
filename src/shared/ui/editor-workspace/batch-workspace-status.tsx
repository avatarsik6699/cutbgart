import { m } from "@/paraglide/messages";

export type BatchWorkspaceSummary = Readonly<{
  active: number;
  completed: number;
  concurrencyLimit: number;
  failed: number;
  modelProgressLabel?: string;
  modelProgressPercent?: number | null;
  queued: number;
  total: number;
}>;

export function BatchWorkspaceStatus(props: { summary: BatchWorkspaceSummary }) {
  const summary = props.summary;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="batch-status">
      <p className="sr-only" data-testid="scheduler-summary">
        {m.batchSummary({
          active: summary.active,
          limit: summary.concurrencyLimit,
          queued: summary.queued,
          done: summary.completed,
          failed: summary.failed,
          total: summary.total,
        })}
      </p>
      <div
        className="flex h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
        data-testid="batch-status-bar"
      >
        {summary.completed > 0 ? (
          <span
            className="bg-success"
            style={{
              width: `${String((summary.completed / Math.max(1, summary.total)) * 100)}%`,
            }}
          />
        ) : null}
        {summary.active > 0 ? (
          <span
            className="bg-info"
            style={{
              width: `${String((summary.active / Math.max(1, summary.total)) * 100)}%`,
            }}
          />
        ) : null}
        {summary.failed > 0 ? (
          <span
            className="bg-destructive"
            style={{
              width: `${String((summary.failed / Math.max(1, summary.total)) * 100)}%`,
            }}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[0.6875rem] text-muted-foreground">
        <span>{m.batchTotalCount({ count: summary.total })}</span>
        <span aria-hidden="true">·</span>
        <span>{m.batchReadyCount({ count: summary.completed })}</span>
        {summary.active > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{m.batchActiveCount({ count: summary.active })}</span>
          </>
        ) : null}
        {summary.queued > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{m.batchQueuedCount({ count: summary.queued })}</span>
          </>
        ) : null}
        {summary.failed > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-destructive">
              {m.batchFailedCount({ count: summary.failed })}
            </span>
          </>
        ) : null}
        {summary.modelProgressLabel ? (
          <>
            <span aria-hidden="true">·</span>
            <span
              role="progressbar"
              aria-valuenow={summary.modelProgressPercent ?? undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="shared-model-progress"
            >
              {summary.modelProgressLabel}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
