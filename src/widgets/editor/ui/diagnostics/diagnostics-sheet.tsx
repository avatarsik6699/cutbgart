import { DiagnosticsDesktopSheet } from "./components/diagnostics-desktop-sheet";
import { DiagnosticsMobileDrawer } from "./components/diagnostics-mobile-drawer";
import type { DiagnosticsTypes } from "./diagnostics.types";

export function DiagnosticsSheet(props: DiagnosticsTypes.SheetProps) {
  return (
    <>
      <DiagnosticsDesktopSheet {...props} />
      <DiagnosticsMobileDrawer {...props} />
    </>
  );
}
