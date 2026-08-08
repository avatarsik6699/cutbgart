import { Database } from "lucide-react";
import { lazy, Suspense } from "react";

import { m } from "@/paraglide/messages";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui";

import { ModelStorageLoading } from "./model-storage-states";

const LazyModelStorageManager = lazy(async () => {
  const module = await import("./ModelStorageManager");
  return { default: module.ModelStorageManager };
});

/**
 * Header entry point for `ModelStorageManager` (Phase 30 `T6`) — replaces the
 * floating `<aside>` that previously sat below the public editor on the home
 * page. `ModelStorageManager` itself only mounts (and loads cache status)
 * while the popover is open.
 */
export function ModelStorageTrigger() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={m.modelStorageTitle()}
        title={m.modelStorageTitle()}
        data-testid="model-storage-trigger"
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Database className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{m.modelStorageTitle()}</PopoverTitle>
        </PopoverHeader>
        <Suspense fallback={<ModelStorageLoading />}>
          <LazyModelStorageManager />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
