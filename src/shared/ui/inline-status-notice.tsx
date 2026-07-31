import type { ReactNode } from "react";

interface InlineStatusNoticeProps {
  children: ReactNode;
}

// Shared "fallback/degraded" banner — was byte-identical between
// `refine-foreground` and `refine-matte`'s controls before extraction
// (PHASE_31 architecture audit).
function InlineStatusNotice({ children }: InlineStatusNoticeProps) {
  return (
    <p
      data-slot="inline-status-notice"
      role="status"
      className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
    >
      {children}
    </p>
  );
}

export { InlineStatusNotice };
