import { m } from "@/paraglide/messages";
import { Skeleton } from "@/shared/ui";

export function DiagnosticsLoading() {
  return (
    <div
      className="grid flex-1 content-start gap-4 p-5"
      data-testid="diagnostics-loading"
      role="status"
    >
      <span className="sr-only">{m.diagnosticsLoading()}</span>
      <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="grid gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
