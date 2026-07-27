import { useState } from "react";

import { m } from "@/paraglide/messages";
import type { LogEntry, RunInfo } from "../../../features/remove-background";

export interface ProcessingLogProps {
  logs: LogEntry[];
  runInfo?: RunInfo | null;
  lightweightMode?: boolean;
  fallbackUsed?: boolean;
  modelLoadBytes?: { loaded: number; total: number | null };
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Collapsible diagnostic trail (model file downloads, state transitions,
 * timings) — opt-in detail beyond the plain 0%→100% progress bar, for users
 * who want to see what's actually happening at a given moment. Placed as a
 * full-width accordion at the bottom of the tool-workspace grid (Phase 12).
 */
export function ProcessingLog({
  logs,
  runInfo = null,
  lightweightMode = false,
  fallbackUsed = false,
  modelLoadBytes,
}: ProcessingLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (
    logs.length === 0 &&
    !runInfo &&
    !lightweightMode &&
    !fallbackUsed &&
    !modelLoadBytes?.loaded
  )
    return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          setExpanded((current) => !current);
        }}
        aria-expanded={expanded}
        className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {expanded ? m.hideDetails() : m.details()}
      </button>
      {expanded && (
        <div
          className="max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground"
          data-testid="processing-details"
        >
          <dl className="mb-2 grid gap-1">
            {runInfo && (
              <div>
                <dt className="inline">runtime: </dt>
                <dd className="inline">
                  {runInfo.inferencePath} · {runInfo.dtype}
                </dd>
              </div>
            )}
            {modelLoadBytes && modelLoadBytes.loaded > 0 && (
              <div>
                <dt className="inline">model bytes: </dt>
                <dd className="inline">
                  {(modelLoadBytes.loaded / 1_048_576).toFixed(1)} MiB
                  {modelLoadBytes.total
                    ? ` / ${(modelLoadBytes.total / 1_048_576).toFixed(1)} MiB`
                    : ""}
                </dd>
              </div>
            )}
            {lightweightMode && (
              <div>
                <dt className="inline">fallback: </dt>
                <dd className="inline">WASM</dd>
              </div>
            )}
            {fallbackUsed && (
              <div>
                <dt className="inline">quality fallback: </dt>
                <dd className="inline">ben2-fp16 → isnet-fp32</dd>
              </div>
            )}
          </dl>
          <ul>
            {logs.map((entry) => (
              <li key={entry.id}>
                <span className="text-muted-foreground/60">
                  {formatTime(entry.timestamp)}
                </span>{" "}
                {entry.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
