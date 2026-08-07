import { lazy, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { DiagnosticsLoadError } from "./diagnostics-load-error";
import { DiagnosticsLoading } from "./diagnostics-loading";
import type { DiagnosticsTypes } from "../diagnostics.types";

const LazyDiagnosticsBody = lazy(async function loadDiagnosticsBodyModule() {
  const module = await import("./diagnostics-body");

  return { default: module.DiagnosticsBody };
});

export function DiagnosticsContent(props: DiagnosticsTypes.SheetProps) {
  return (
    <ErrorBoundary fallback={<DiagnosticsLoadError />}>
      <Suspense fallback={<DiagnosticsLoading />}>
        <LazyDiagnosticsBody {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
