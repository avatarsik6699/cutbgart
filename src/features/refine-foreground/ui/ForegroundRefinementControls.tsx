import { useState } from "react";

import { m } from "@/paraglide/messages";
import { Button, InlineStatusNotice, ProgressBar } from "@/shared/ui";

import type {
  ForegroundRefinementError,
  ForegroundRefinementResult,
  ForegroundRefinementStatus,
} from "../model/types";

/**
 * @deprecated Not rendered anywhere in production — `EnhancementsToolPanel`
 * (`widgets/tool-workspace`) drives this feature's business logic
 * (`useForegroundRefinement`) through its own generic progress/error UI
 * instead. The "component cleanup" checkbox this component offers is
 * unreachable; the controller hardcodes `componentCleanup: true`. Confirmed
 * intentional by the architect (2026-07-31, PHASE_31 F-19) — auto-select-only
 * is the desired product behavior, not a regression. Kept only for its own
 * test coverage; candidate for deletion (with its tests) in a future phase
 * once nobody needs the historical reference.
 */
export interface ForegroundRefinementControlsProps {
  status: ForegroundRefinementStatus;
  progress: number | null;
  fallbackReason: string | null;
  result: ForegroundRefinementResult | null;
  error: ForegroundRefinementError | null;
  disabled?: boolean;
  onStart: (componentCleanup: boolean) => void;
  onCancel: () => void;
  onSkip: () => void;
}

/** @deprecated See `ForegroundRefinementControlsProps` — not rendered in production. */
export function ForegroundRefinementControls({
  status,
  progress,
  fallbackReason,
  result,
  error,
  disabled = false,
  onStart,
  onCancel,
  onSkip,
}: ForegroundRefinementControlsProps) {
  const [componentCleanup, setComponentCleanup] = useState(true);
  const busy = ["preparing", "refining", "applying", "fallback"].includes(status);
  const terminalError = status === "error" || result?.fallback === "processing-failed";
  const terminalMessage = terminalError
    ? error?.code === "device-out-of-memory"
      ? m.foregroundRefinementOutOfMemory()
      : m.foregroundRefinementError()
    : status === "result" && result
      ? result.actualPath === "unchanged"
        ? m.foregroundRefinementUnchanged()
        : m.foregroundRefinementApplied()
      : null;

  return (
    <section
      className="space-y-3 rounded-xl border bg-muted/20 p-4"
      aria-labelledby="foreground-refinement-title"
      data-testid="foreground-refinement-controls"
    >
      <div>
        <h3
          id="foreground-refinement-title"
          className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {m.foregroundRefinementTitle()}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {m.foregroundRefinementHint()}
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors duration-200 hover:border-foreground/30 hover:bg-accent/30 motion-reduce:transition-none has-[:checked]:border-primary has-[:checked]:bg-primary/5">
        <input
          type="checkbox"
          checked={componentCleanup}
          disabled={busy || disabled}
          onChange={(event) => setComponentCleanup(event.currentTarget.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium">{m.foregroundRefinementComponents()}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {m.foregroundRefinementComponentsHint()}
          </span>
        </span>
      </label>
      {terminalMessage && (
        <p
          role={terminalError ? "alert" : "status"}
          className={
            terminalError
              ? "rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
              : "rounded-lg border border-border bg-success p-3 text-xs text-success-foreground"
          }
        >
          {terminalMessage}
        </p>
      )}
      {fallbackReason && !terminalMessage && status !== "fallback" && (
        <InlineStatusNotice>{m.foregroundRefinementFallback()}</InlineStatusNotice>
      )}
      {busy && (
        <div className="space-y-2" role="status">
          <p className="text-sm text-muted-foreground">
            {status === "fallback"
              ? m.foregroundRefinementFallback()
              : m.foregroundRefinementProgress({
                  progress: String(Math.round(progress ?? 0)),
                })}
          </p>
          {progress !== null && <ProgressBar value={progress} />}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {busy ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {m.foregroundRefinementCancel()}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={disabled}
            onClick={() => onStart(componentCleanup)}
          >
            {status === "result"
              ? m.foregroundRefinementAgain()
              : status === "error"
                ? m.foregroundRefinementRetry()
                : m.foregroundRefinementStart()}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={busy || disabled}
          onClick={onSkip}
        >
          {m.foregroundRefinementSkip()}
        </Button>
      </div>
    </section>
  );
}
