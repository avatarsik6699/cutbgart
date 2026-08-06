import type { DiagnosticsSheetProps } from "./diagnostics.types";

export function hasDiagnosticsDetails(props: DiagnosticsSheetProps): boolean {
  const hasLogs = props.logs.length > 0;
  const hasRunInfo = props.runInfo !== null && props.runInfo !== undefined;
  const hasModelProgress = (props.modelLoadBytes?.loaded ?? 0) > 0;
  const hasRuntimeFallback = props.lightweightMode === true;
  const hasQualityFallback = props.fallbackUsed === true;

  return (
    hasLogs || hasRunInfo || hasModelProgress || hasRuntimeFallback || hasQualityFallback
  );
}
