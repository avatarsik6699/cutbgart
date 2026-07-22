import { useState } from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";

import type {
  ForegroundRefinementError,
  ForegroundRefinementResult,
  ForegroundRefinementStatus,
} from "../model/types";

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
        <h3 id="foreground-refinement-title" className="text-sm font-semibold">
          {m.foregroundRefinementTitle()}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {m.foregroundRefinementHint()}
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
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
              : "rounded-lg border border-emerald-500/40 bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
          }
        >
          {terminalMessage}
        </p>
      )}
      {fallbackReason && !terminalMessage && status !== "fallback" && (
        <p
          role="status"
          className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {m.foregroundRefinementFallback()}
        </p>
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
          {progress !== null && (
            <div
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${String(Math.round(progress))}%` }}
              />
            </div>
          )}
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
