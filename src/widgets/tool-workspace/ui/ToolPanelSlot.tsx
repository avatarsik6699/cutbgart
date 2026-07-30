import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export interface ToolPanelSlotProps {
  children: ReactNode;
  label: string;
  toolId: string;
  /** Size to content instead of reserving the full editing-panel height —
   * for placeholder/empty states (e.g. batch mode before an item is picked)
   * that would otherwise leave most of a tall fixed-height card blank. */
  fitContent?: boolean;
}

export function ToolPanelSlot({
  children,
  label,
  toolId,
  fitContent = false,
}: ToolPanelSlotProps) {
  return (
    <section
      aria-label={label}
      data-testid="tool-panel-slot"
      data-active-tool={toolId}
      className={cn(
        "editor-tool-panel flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-card p-4 sm:p-5",
        fitContent ? "min-[56rem]:min-h-72" : "min-[56rem]:h-[clamp(22rem,62dvh,46rem)]",
      )}
    >
      {children}
    </section>
  );
}
