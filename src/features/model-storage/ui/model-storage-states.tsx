import { PackageOpen } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Skeleton } from "@/shared/ui";

export function ModelStorageLoading() {
  return (
    <div className="grid gap-2" data-testid="model-storage-loading" role="status">
      <span className="sr-only">{m.modelStorageLoading()}</span>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-8 w-2/3 rounded-md" />
    </div>
  );
}

export function ModelStorageEmpty() {
  return (
    <div
      className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center"
      data-testid="model-storage-empty"
    >
      <span className="grid size-9 place-items-center rounded-full border border-border bg-background text-muted-foreground">
        <PackageOpen className="size-4" aria-hidden="true" />
      </span>
      <div className="grid gap-1">
        <p className="font-medium text-foreground">{m.modelStorageEmptyTitle()}</p>
        <p className="text-xs leading-relaxed">{m.modelStorageEmptyDescription()}</p>
      </div>
    </div>
  );
}
