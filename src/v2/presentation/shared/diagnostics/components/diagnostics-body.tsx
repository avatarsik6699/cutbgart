import { hasDiagnosticsDetails } from "../diagnostics-details.utils";
import { DiagnosticsEmptyState } from "./diagnostics-empty-state";
import { DiagnosticsLogList } from "./diagnostics-log-list";
import { DiagnosticsRuntimeDetails } from "./diagnostics-runtime-details";
import type { DiagnosticsSheetProps } from "../diagnostics.types";

export function DiagnosticsBody(props: DiagnosticsSheetProps) {
  if (!hasDiagnosticsDetails(props)) return <DiagnosticsEmptyState />;

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto p-5 font-mono text-xs text-muted-foreground"
      data-testid="processing-details"
    >
      <DiagnosticsRuntimeDetails
        fallbackUsed={props.fallbackUsed}
        lightweightMode={props.lightweightMode}
        modelLoadBytes={props.modelLoadBytes}
        runInfo={props.runInfo}
      />
      <DiagnosticsLogList logs={props.logs} />
    </div>
  );
}
