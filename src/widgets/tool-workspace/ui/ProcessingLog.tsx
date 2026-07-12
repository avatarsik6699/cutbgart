import { useState } from "react";

import { m } from "@/paraglide/messages";
import type { LogEntry } from "../../../features/remove-background";

export interface ProcessingLogProps {
  logs: LogEntry[];
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
export function ProcessingLog({ logs }: ProcessingLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (logs.length === 0) return null;

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
        {expanded ? m.hideLog() : m.showLog({ count: String(logs.length) })}
      </button>
      {expanded && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2 font-mono text-xs text-muted-foreground">
          {logs.map((entry) => (
            <li key={entry.id}>
              <span className="text-muted-foreground/60">
                {formatTime(entry.timestamp)}
              </span>{" "}
              {entry.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
