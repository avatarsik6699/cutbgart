import { TriangleAlert } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

export function DiagnosticsLoadError() {
  return (
    <div className="grid min-h-56 flex-1 place-items-center p-5 text-center" role="alert">
      <div className="grid max-w-64 justify-items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
        </span>
        <div className="grid gap-1.5">
          <Typography variant="body-small" className="font-medium leading-5">
            {m.diagnosticsErrorTitle()}
          </Typography>
          <Typography variant="caption" className="leading-relaxed">
            {m.diagnosticsErrorDescription()}
          </Typography>
        </div>
      </div>
    </div>
  );
}
