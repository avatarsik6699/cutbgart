import { formatLocalTime } from "@/shared/lib";

import type { DiagnosticsTypes } from "../diagnostics.types";

type Props = Readonly<{ logs: readonly DiagnosticsTypes.LogEntry[] }>;

export function DiagnosticsLogList(props: Props) {
  if (props.logs.length === 0) return null;

  return (
    <ul className="grid gap-1.5">
      {props.logs.map((entry) => (
        <li key={entry.id}>
          <span className="text-muted-foreground/60">
            {formatLocalTime(entry.timestamp)}
          </span>{" "}
          {entry.message}
        </li>
      ))}
    </ul>
  );
}
