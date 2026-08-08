import { cn } from "@/shared/lib/utils";

export interface LocalExecutionReadoutProps {
  /** Whether background-removal/enhancement work is actively running. */
  busy: boolean;
  /** Resolved inference backend, once known (`null` before detection settles). */
  inferencePath: "webgpu" | "wasm" | null;
}

/**
 * The product's core promise — "nothing is ever uploaded, everything runs in
 * your browser" — expressed as a live system-interface status readout
 * (Phase 30 `T27`, docs/design/DESIGN_SYSTEM.md §9) instead of marketing
 * copy. Presentational only: reads existing controller status, no new state.
 * Deliberately not localized, matching `DiagnosticsSheet`'s existing
 * technical-readout convention (docs/design/DESIGN_SYSTEM.md §4).
 */
export function LocalExecutionReadout({
  busy,
  inferencePath,
}: LocalExecutionReadoutProps) {
  const engineLabel = inferencePath ?? "on-device";
  return (
    <span
      className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 font-mono text-[0.6875rem] text-muted-foreground sm:inline-flex"
      data-testid="local-execution-readout"
      data-busy={busy}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full bg-local",
          busy && "motion-safe:animate-pulse",
        )}
      />
      {busy ? `on-device · ${engineLabel}` : "on-device"}
    </span>
  );
}
