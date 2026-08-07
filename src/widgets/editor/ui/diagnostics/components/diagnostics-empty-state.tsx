import { Activity } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

export function DiagnosticsEmptyState() {
  return (
    <div
      className="grid min-h-56 flex-1 place-items-center p-5 text-center"
      data-testid="processing-details"
    >
      <div className="grid max-w-64 justify-items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full border border-border bg-muted/30 text-muted-foreground">
          <Activity className="size-4" aria-hidden="true" />
        </span>
        <div className="grid gap-1.5">
          <Typography variant="body-small" className="font-sans font-medium leading-5">
            {m.diagnosticsEmptyTitle()}
          </Typography>
          <Typography variant="caption" className="font-sans leading-relaxed">
            {m.diagnosticsEmptyDescription()}
          </Typography>
        </div>
      </div>
    </div>
  );
}
