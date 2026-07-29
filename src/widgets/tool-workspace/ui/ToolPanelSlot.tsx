import type { ReactNode } from "react";

export interface ToolPanelSlotProps {
  children: ReactNode;
  label: string;
  toolId: string;
}

export function ToolPanelSlot({ children, label, toolId }: ToolPanelSlotProps) {
  return (
    <section
      aria-label={label}
      data-testid="tool-panel-slot"
      data-active-tool={toolId}
      className="editor-tool-panel flex min-h-0 flex-col overflow-y-auto rounded-2xl border bg-card p-4 shadow-sm sm:p-5 min-[56rem]:h-[clamp(22rem,62dvh,46rem)]"
    >
      <h2 className="mb-4 text-base font-semibold">{label}</h2>
      {children}
    </section>
  );
}
