import { Database } from "lucide-react";

import { m } from "@/paraglide/messages";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui";
import { ModelStorageManager } from "./ModelStorageManager";

/**
 * Header entry point for `ModelStorageManager` (Phase 30 `T6`) — replaces the
 * floating `<aside>` that previously sat below `ToolWorkspace` on the home
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
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>{m.modelStorageTitle()}</PopoverTitle>
        </PopoverHeader>
        <ModelStorageManager />
      </PopoverContent>
    </Popover>
  );
}
